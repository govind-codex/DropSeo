import { after } from "next/server";
import { validateWebsiteUrl } from "@/lib/investigation-intent";
import { prepareReportFindings, supportsVerification } from "@/lib/finding-presentation";
import { analyzeAuthenticatedWebsite as analyzeWebsite } from "@/lib/website-analysis";
import { getInvestigation, saveInvestigation, type Investigation } from "@/lib/investigations";
import { compareInvestigations } from "@/lib/investigation-comparison";
import { getSession, validMutationOrigin } from "@/lib/auth";
import { releaseInvestigation, reserveInvestigation, type PlanUsage } from "@/lib/plan-entitlements";

export const runtime = "nodejs";
export const maxDuration = 300;

type AgentInput = {
  url?: string;
  workflow?: "autonomous" | "journey" | "performance" | "verify";
  goal?: string;
  workflowId?: string;
  investigationId?: string;
  findingId?: string;
  referenceUrls?: string[];
  maxPages?: number;
};

type AuditCheck = {
  name: string;
  pass: boolean;
  detail: string;
  fix: string;
  category: string;
};

type Analysis = {
  url: string;
  title: string;
  score: number;
  checks: AuditCheck[];
  ttfb: number;
  load: number;
  images: number;
  scripts: number;
  styles: number;
  links?: Array<{ url: string; text: string }>;
  ai?: {
    summary?: string;
    verdict?: string;
    quickWins?: Array<{ title: string; why: string; action: string; impact: string }>;
  } | null;
  aiError?: string | null;
  error?: string;
};

export function GET() {
  const useExternalBrowser = Boolean(process.env.AGENT_WORKER_URL) && process.env.AGENT_BROWSER_MODE !== "portable";
  return Response.json({
    ok: true,
    service: "audifox-agent",
    mode: useExternalBrowser ? "external-browser" : "portable-analysis",
  });
}

class WorkerStartError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

function rejectedWorkerMessage(status: number) {
  if (status === 404) return "The browser investigation service could not be found. Please contact support so we can reconnect it.";
  if (status === 401 || status === 403) return "The browser investigation service could not authenticate. Please contact support so we can restore access.";
  if (status === 429 || status === 503) return "The browser investigation service is temporarily unavailable. Please try again later.";
  return "The browser investigation service could not start this run. Please try again later or contact support.";
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Sign in with Google to start an investigation." }, { status: 401 });
  if (!validMutationOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let pendingRecord: Investigation | undefined;
  let reservation: PlanUsage | undefined;
  let streamStarted = false;
  try {
    const payload = await request.text();
    let input = JSON.parse(payload || "{}") as AgentInput;
    let reference: Investigation | null = null;
    let selectedFindingId: string | undefined;
    if (input.workflow === "verify") {
      if (!input.investigationId) return Response.json({ error: "Open a saved investigation to verify its fixes." }, { status: 400 });
      reference = await getInvestigation(user.id, input.investigationId);
      if (!reference) return Response.json({ error: "Investigation not found." }, { status: 404 });
      // Follow the immutable original, even when verifying a previous verification.
      if (reference.referenceId) reference = await getInvestigation(user.id, reference.referenceId);
      if (!reference?.result) return Response.json({ error: "Wait for the original investigation to finish before verifying." }, { status: 409 });
      const browserAvailable = Boolean(process.env.AGENT_WORKER_URL?.trim()) && process.env.AGENT_BROWSER_MODE !== "portable";
      if (Boolean(reference.result.browserIntelligence) !== browserAvailable) return Response.json({ error: "Targeted verification requires the original investigation engine. Start a new investigation or ask support to reconnect that engine." }, { status: 422 });
      const findings = reference.result.findings as Array<{ id: string; title: string; expected: string; workflowId?: string }>;
      const selected = input.findingId ? findings.find((item) => item.id === input.findingId) : undefined;
      if (input.findingId && !selected) return Response.json({ error: "Finding not found in the original investigation." }, { status: 404 });
      if (selected && !supportsVerification(selected, reference.result)) return Response.json({ error: "This finding has no matching check that can be rerun. Start a new investigation instead." }, { status: 422 });
      if (!selected && !findings.some((finding) => supportsVerification(finding, reference!.result!))) return Response.json({ error: "This report has no supported checks to verify." }, { status: 422 });
      selectedFindingId = selected?.id;
      const affected = selected ? (reference.result.checkEvidence as Array<{ url: string; checks: Array<{ name: string; pass: boolean }> }>).filter((page) => page.checks.some((check) => check.name === selected.title && !check.pass)).map((page) => page.url) : reference.result.visitedPages as string[];
      input = { url: affected?.[0] || reference.url, workflow: "verify", goal: selected ? `${selected.title}. Expected behavior: ${selected.expected}` : reference.goal,
        referenceUrls: affected, workflowId: selected?.workflowId || (reference.result.browserIntelligence as { workflow?: { id?: string } } | undefined)?.workflow?.id };
    } else {
      input = { url: input.url, workflow: input.workflow, goal: input.goal };
    }
    input.url = validateWebsiteUrl(String(input.url || ""));
    if (input.workflow && !["autonomous", "journey", "performance", "verify"].includes(input.workflow)) return Response.json({ error: "Choose a supported investigation goal." }, { status: 400 });
    input.goal = String(input.goal || "").trim().slice(0, 500);
    if (input.workflow === "journey" && !input.goal) return Response.json({ error: "Describe the visitor goal." }, { status: 400 });
    const allowance = await reserveInvestigation(user.id, user.email);
    if (!allowance.allowed) {
      return Response.json({
        error: `You have used all ${allowance.usage.limit} ${allowance.usage.planName} investigations for this month.`,
        code: "PLAN_LIMIT_REACHED",
        usage: allowance.usage,
      }, { status: 429 });
    }
    reservation = allowance.usage;
    input.maxPages = allowance.usage.maxPages;
    const record: Investigation = { id: crypto.randomUUID(), userId: user.id, url: String(input.url || ""), workflow: input.workflow || "autonomous", goal: String(input.goal || ""),
      status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), referenceId: reference?.id, findingId: selectedFindingId, events: [] };
    await saveInvestigation(record);
    pendingRecord = record;
    const workerUrl = process.env.AGENT_WORKER_URL?.trim();
    const useExternalBrowser = Boolean(workerUrl) && process.env.AGENT_BROWSER_MODE !== "portable";

    if (useExternalBrowser && workerUrl) {
      const token = process.env.AGENT_WORKER_TOKEN || (process.env.NODE_ENV !== "production" ? "sitepulse_worker_secret_token_1a2b3c4d5e" : undefined);
      if (!token) throw new WorkerStartError("The browser investigation service is not configured. Please contact support.", "WORKER_CONFIGURATION_ERROR");
      let runUrl: URL;
      try {
        runUrl = new URL("/run", workerUrl);
        if (!["https:", "http:"].includes(runUrl.protocol) || runUrl.username || runUrl.password) throw new Error();
      } catch { throw new WorkerStartError("The browser investigation service is not configured correctly. Please contact support.", "WORKER_CONFIGURATION_ERROR"); }
      const upstream = await fetch(runUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...input, ownerId: user.id, baselineResult: reference?.result }),
        signal: AbortSignal.timeout(240_000),
        redirect: "error",
      }).catch(() => { throw new WorkerStartError("The browser investigation service could not be reached. Please try again later or contact support.", "WORKER_UNREACHABLE"); });

      if (!upstream.ok || !upstream.body) {
        // Hosting-provider JSON/HTML is infrastructure detail, not a visitor error.
        await upstream.body?.cancel();
        const message = rejectedWorkerMessage(upstream.status);
        record.status = "failed"; record.error = message; await saveInvestigation(record);
        await releaseInvestigation(user.id, allowance.usage.period);
        reservation = undefined;
        return Response.json({ error: message, code: upstream.status === 404 ? "WORKER_NOT_FOUND" : "WORKER_START_REJECTED" }, { status: 502 });
      }
      streamStarted = true;
      return persistStream(upstream, record, reference);
    }

    streamStarted = true;
    return persistStream(portableAnalysisStream(request, input), record, reference);
  } catch (error) {
    if (reservation && !streamStarted) await releaseInvestigation(user.id, reservation.period).catch(() => undefined);
    if (pendingRecord) { pendingRecord.status = "failed"; pendingRecord.error = error instanceof Error ? error.message : "Unable to start investigation."; await saveInvestigation(pendingRecord).catch(() => {}); }
    return Response.json({ error: error instanceof Error ? error.message : "Unable to start the website analysis.", ...(error instanceof WorkerStartError ? { code: error.code } : {}) }, { status: error instanceof WorkerStartError ? 502 : 400 });
  }
}

function portableAnalysisStream(request: Request, input: AgentInput) {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const workflow = input.workflow || "autonomous";
  const encoder = new TextEncoder();
  let streamClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: Record<string, unknown>) => {
        if (!streamClosed) controller.enqueue(encoder.encode(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`));
      };
      const finish = () => {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      };

      void (async () => {
        const maxPages = Math.max(1, Math.min(30, Number(input.maxPages) || 4));
        push({ type: "run", runId, workflow, status: "observing", limits: { maxPages, timeoutSeconds: 55 } });
        push({ type: "activity", status: "running", title: "Validating the target", detail: "Confirming this is a public HTTP website." });
        push({ type: "activity", status: "running", title: "Fetching website evidence", detail: String(input.url || "") });

        const analysisResponse = await analyzeWebsite(new Request(request.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: input.url }),
        }));
        const analysis = await analysisResponse.json() as Analysis;
        if (!analysisResponse.ok) throw new Error(analysis.error || "The website could not be analyzed.");

        const analyses = [analysis];
        const pageLinks = (input.referenceUrls ? input.referenceUrls.filter((url) => url !== analysis.url && new URL(url).origin === new URL(analysis.url).origin) : selectInvestigationLinks(analysis.links || [], analysis.url, input.goal || "")).slice(0, maxPages - 1);
        push({ type: "activity", status: "complete", title: "Homepage evidence collected", detail: `${analysis.checks.length} document checks completed. Screenshots are not captured in portable mode.` });
        push({
          type: "profile",
          profile: {
            siteType: analysis.title || "Public website",
            purpose: analysis.ai?.summary || `Multi-page technical, search and accessibility audit for ${analysis.url}`,
            primaryJourney: input.goal || "Find the highest-impact website improvements",
            plan: ["Collect homepage document evidence", "Inspect important same-domain pages", "Compare technical and accessibility signals", "Prioritize findings"],
          },
        });

        for (let index = 0; index < pageLinks.length; index += 1) {
          if (Date.now() - startedAt > 210_000) { push({ type: "activity", status: "warning", title: "Browsing time limit reached", detail: "The report includes only pages inspected before the limit." }); break; }
          const target = pageLinks[index];
          push({ type: "activity", status: "running", title: `Inspecting page ${index + 2} of ${pageLinks.length + 1}`, detail: target });
          try {
            const pageResponse = await analyzeWebsite(new Request(request.url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url: target, skipAi: true }),
            }));
            const pageAnalysis = await pageResponse.json() as Analysis;
            if (!pageResponse.ok) throw new Error(pageAnalysis.error || "Page could not be analyzed.");
            analyses.push(pageAnalysis);
            push({ type: "activity", status: "complete", title: `Page ${index + 2} verified`, detail: `${pageAnalysis.title || pathname(pageAnalysis.url)} · score ${pageAnalysis.score}/100 · ${pageAnalysis.load} ms response.` });
          } catch (error) {
            push({ type: "activity", status: "warning", title: `Page ${index + 2} could not be inspected`, detail: error instanceof Error ? error.message : target });
          }
        }

        push({ type: "activity", status: "complete", title: "Cross-page signals compared", detail: `${analyses.length * analysis.checks.length} checks across ${analyses.length} pages.` });
        push({ type: "activity", status: analysis.ai ? "complete" : "warning", title: analysis.ai ? "AI recommendations prepared" : "Verified recommendations prepared", detail: analysis.ai?.verdict || "AI enrichment is unavailable, so the report is prioritized from verified page evidence." });

        const findings = aggregateFindings(analyses);

        if (workflow === "verify") {
          push({ type: "activity", status: "warning", title: "Browser replay unavailable", detail: "Technical checks are compared with the original report. Interactive behavior needs matching browser replay evidence." });
        }

        for (const win of analysis.ai?.quickWins || []) {
          if (findings.some((finding) => finding.title.toLowerCase() === win.title.toLowerCase())) continue;
          findings.push({
            id: crypto.randomUUID(),
            category: "AI strategy",
            severity: win.impact === "High" ? "high" : "medium",
            title: win.title,
            expected: win.why,
            observed: analysis.ai?.verdict || "Gemini identified an optimization opportunity.",
            recommendation: win.action,
            confidence: "hypothesis",
            evidenceType: "ai-analysis",
            affectedUrls: [analysis.url],
            evidence: [{ url: analysis.url, detail: `Unverified AI theory: ${win.why}` }],
          });
        }

        findings.forEach((finding) => push({ type: "finding", finding }));
        const averageScore = Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length);
        const highestPriority = findings.find((finding) => finding.severity === "high") || findings[0];
        const defaultOutcome = analysis.ai?.verdict || `Audited ${analyses.length} pages with an average score of ${averageScore}/100.${highestPriority ? ` Highest priority: ${highestPriority.title}.` : " No material issues were verified."}`;
        const outcome = workflow === "journey"
          ? `Audited ${analyses.length} goal-relevant pages, but the visitor goal was not marked complete because interactive browser evidence was unavailable.`
          : workflow === "performance"
            ? `Measured server and document response evidence across ${analyses.length} pages. Browser-rendered LCP, CLS and long-task measurements require the live browser worker.`
            : workflow === "verify"
              ? "Compared fresh technical checks with the original investigation. See the issue-by-issue verification below."
              : defaultOutcome;
        const result = {
          runId,
          workflow,
          goal: String(input.goal || ""),
          status: "completed",
          completedAt: new Date().toISOString(),
          mode: "portable-analysis",
          outcome,
          visitedPages: analyses.map((item) => item.url),
          actions: analyses.map((item, index) => ({ sequence: index + 1, action: "inspect", ok: true, url: item.url })),
          performance: {
            ttfb: Math.max(...analyses.map((item) => item.ttfb)),
            domContentLoaded: Math.max(...analyses.map((item) => item.load)),
            load: Math.max(...analyses.map((item) => item.load)),
            resources: analyses.reduce((sum, item) => sum + item.images + item.scripts + item.styles, 0),
            vitals: { lcp: 0, cls: 0, longTasks: 0 },
          },
          findings,
          checkEvidence: analyses.map((item) => ({ url: item.url, checks: item.checks })),
          safety: { blockedActions: 0, domainRestricted: true, sensitiveFieldsProtected: true },
          durationMs: Date.now() - startedAt,
        };
        push({ type: "activity", status: "complete", title: "Report finalized", detail: `${findings.length} prioritized findings are ready.` });
        push({ type: "complete", result });
      })()
        .catch((error) => push({ type: "error", error: error instanceof Error ? error.message : "The website analysis failed." }))
        .finally(finish);
    },
    cancel() { streamClosed = true; },
  });

  return new Response(stream, { headers: streamHeaders() });
}

function streamHeaders() {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
  };
}

function pathname(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function selectInvestigationLinks(links: Array<{ url: string; text: string }>, homeUrl: string, goal: string) {
  const home = new URL(homeUrl);
  const goalTerms = goal.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const preferred = ["pricing", "product", "service", "feature", "about", "contact", "solution", "case", "blog"];
  const unique = new Map<string, { url: string; score: number }>();

  for (const link of links) {
    try {
      const candidate = new URL(link.url);
      if (candidate.origin !== home.origin || candidate.href === home.href) continue;
      if (/\/(?:login|log-in|signin|sign-in|signup|sign-up|account|admin|cart|checkout)(?:\/|$)/i.test(candidate.pathname)) continue;
      const haystack = `${link.text} ${candidate.pathname}`.toLowerCase();
      const score = goalTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 8 : 0), 0)
        + preferred.reduce((sum, term, index) => sum + (haystack.includes(term) ? preferred.length - index : 0), 0)
        - candidate.pathname.split("/").length;
      const key = `${candidate.origin}${candidate.pathname}`.replace(/\/$/, "") || candidate.origin;
      if (!unique.has(key) || unique.get(key)!.score < score) unique.set(key, { url: candidate.href, score });
    } catch {
      // Ignore malformed links collected from untrusted markup.
    }
  }

  return [...unique.values()].sort((a, b) => b.score - a.score).map((item) => item.url);
}

function aggregateFindings(analyses: Analysis[]) {
  const grouped = new Map<string, { check: AuditCheck; failures: Array<{ url: string; detail: string }> }>();
  for (const analysis of analyses) {
    for (const check of analysis.checks) {
      if (check.pass) continue;
      const group = grouped.get(check.name) || { check, failures: [] };
      group.failures.push({ url: analysis.url, detail: check.detail });
      grouped.set(check.name, group);
    }
  }

  return [...grouped.values()]
    .sort((a, b) => {
      const severity = (item: typeof a) => item.check.category === "Technical" ? 2 : 1;
      return severity(b) - severity(a) || b.failures.length - a.failures.length;
    })
    .map(({ check, failures }) => ({
      id: crypto.randomUUID(),
      category: check.category,
      severity: check.category === "Technical" ? "high" : "medium",
      title: check.name,
      expected: `All ${analyses.length} audited pages should pass this check.`,
      observed: `${failures.length} of ${analyses.length} pages failed: ${failures.map((failure) => `${pathname(failure.url)} — ${failure.detail}`).join("; ")}`,
      recommendation: `${check.fix} Start with ${pathname(failures[0].url)}${failures.length > 1 ? `, then apply the correction consistently to the other ${failures.length - 1} affected page${failures.length > 2 ? "s" : ""}.` : "."}`,
      confidence: "verified",
      evidenceType: "document-check",
      affectedUrls: failures.map((failure) => failure.url),
      evidence: failures.map((failure) => ({ url: failure.url, detail: failure.detail })),
    }));
}

function persistStream(response: Response, record: Investigation, reference: Investigation | null) {
  const encoder = new TextEncoder();
  let disconnected = false;
  let finished: Promise<void> = Promise.resolve();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      finished = (async () => {
      const send = (event: Record<string, unknown>) => { if (!disconnected) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      send({ type: "saved", investigationId: record.id });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      async function accept(event: Record<string, unknown>) {
        if (event.type === "complete") {
          const result = prepareReportFindings(event.result as Record<string, unknown>);
          if (reference) {
            const baseline = record.findingId ? { ...reference, result: { ...reference.result, findings: (reference.result!.findings as Array<{ id: string }>).filter((finding) => finding.id === record.findingId) } } : reference;
            result.comparison = compareInvestigations(baseline, result);
            result.verifiedAt = new Date().toISOString();
          }
          record.result = result; record.status = "completed";
        }
        if (event.type === "run") record.status = "running";
        if (event.type === "status" && ["queued", "running"].includes(String(event.status))) record.status = event.status as "queued" | "running";
        if (event.type === "error") { record.status = "failed"; record.error = String(event.error); }
        record.events.push(event);
        // Persist before delivering so refreshes and disconnected clients keep all evidence.
        await saveInvestigation(record);
        send(event);
      }
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n"); buffer = lines.pop() || "";
          for (const line of lines) if (line.trim()) await accept(JSON.parse(line));
          if (done) break;
        }
        if (buffer.trim()) await accept(JSON.parse(buffer));
        if (record.status === "running" || record.status === "queued") throw new Error("The investigation ended before a report was completed.");
      } catch (error) {
        record.status = "failed"; record.error = error instanceof Error ? error.message : "Investigation interrupted.";
        const event = { type: "error", error: record.error, at: new Date().toISOString() };
        record.events.push(event);
        await saveInvestigation(record).catch(() => {});
        send(event);
      } finally { reader.releaseLock(); if (!disconnected) controller.close(); }
      })();
    },
    cancel() { disconnected = true; },
  });
  // Keep persistence alive after the response or browser connection closes.
  after(async () => { await finished; });
  return new Response(stream, { headers: { ...streamHeaders(), "X-Investigation-ID": record.id } });
}
