import { analyzeAuthenticatedWebsite as analyzeWebsite } from "@/lib/website-analysis";
import { getSession, validMutationOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

type AgentInput = {
  url?: string;
  workflow?: "autonomous" | "journey" | "performance" | "verify";
  goal?: string;
  workflowId?: string;
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
    service: "dropseo-agent",
    mode: useExternalBrowser ? "external-browser" : "portable-analysis",
  });
}

export async function POST(request: Request) {
  if (!(await getSession())) return Response.json({ error: "Sign in with Google to start an investigation." }, { status: 401 });
  if (!validMutationOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const payload = await request.text();
    const input = JSON.parse(payload || "{}") as AgentInput;
    const workerUrl = process.env.AGENT_WORKER_URL?.trim();
    const useExternalBrowser = Boolean(workerUrl) && process.env.AGENT_BROWSER_MODE !== "portable";

    if (useExternalBrowser && workerUrl) {
      const token = process.env.AGENT_WORKER_TOKEN;
      const upstream = await fetch(new URL("/run", workerUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: payload,
        signal: request.signal,
      });

      if (!upstream.ok || !upstream.body) {
        const message = await upstream.text();
        return Response.json({ error: message || "The browser worker could not start this run." }, { status: upstream.status || 502 });
      }
      return new Response(upstream.body, { headers: streamHeaders() });
    }

    return portableAnalysisStream(request, input);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to start the website analysis." }, { status: 400 });
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
        push({ type: "run", runId, workflow, status: "observing", limits: { maxPages: 4, timeoutSeconds: 55 } });
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
        const pageLinks = selectInvestigationLinks(analysis.links || [], analysis.url, input.goal || "").slice(0, 3);
        push({ type: "snapshot", image: screenshotUrl(analysis.url), url: analysis.url, source: "rendered-page" });
        push({ type: "activity", status: "complete", title: "Homepage evidence collected", detail: `${analysis.checks.length} checks completed and a rendered screenshot requested.` });
        push({
          type: "profile",
          profile: {
            siteType: analysis.title || "Public website",
            purpose: analysis.ai?.summary || `Multi-page technical, search and accessibility audit for ${analysis.url}`,
            primaryJourney: input.goal || "Find the highest-impact website improvements",
            plan: ["Capture rendered homepage evidence", "Inspect important same-domain pages", "Compare technical and accessibility signals", "Prioritize verified fixes"],
          },
        });

        for (let index = 0; index < pageLinks.length; index += 1) {
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
            push({ type: "snapshot", image: screenshotUrl(pageAnalysis.url), url: pageAnalysis.url, source: "rendered-page" });
            push({ type: "activity", status: "complete", title: `Page ${index + 2} verified`, detail: `${pageAnalysis.title || pathname(pageAnalysis.url)} · score ${pageAnalysis.score}/100 · ${pageAnalysis.load} ms response.` });
          } catch (error) {
            push({ type: "activity", status: "warning", title: `Page ${index + 2} could not be inspected`, detail: error instanceof Error ? error.message : target });
          }
        }

        push({ type: "activity", status: "complete", title: "Cross-page signals compared", detail: `${analyses.length * analysis.checks.length} checks across ${analyses.length} pages.` });
        push({ type: "activity", status: analysis.ai ? "complete" : "warning", title: analysis.ai ? "AI recommendations prepared" : "Verified recommendations prepared", detail: analysis.ai?.verdict || "AI enrichment is unavailable, so the report is prioritized from verified page evidence." });

        const findings = aggregateFindings(analyses);

        if (workflow === "verify") {
          findings.unshift({
            id: crypto.randomUUID(),
            category: "Verification",
            severity: "high",
            title: "A browser replay is required to verify this fix",
            expected: String(input.goal || "The previous behavior should pass during an exact replay."),
            observed: "The portable analyzer collected current page evidence but cannot replay a saved browser workflow.",
            recommendation: "Connect the live browser worker, then rerun the saved finding or workflow.",
            confidence: "verified",
            evidenceType: "capability-check",
          });
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
              ? "The fix was not marked verified because no saved browser workflow was replayed."
              : defaultOutcome;
        const result = {
          runId,
          workflow,
          goal: String(input.goal || ""),
          status: "completed",
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

function screenshotUrl(url: string) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`;
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
      evidenceType: "multi-page + screenshot",
    }));
}
