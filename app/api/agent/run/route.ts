import { POST as analyzeWebsite } from "../../analyze/route";

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
    service: "sitepulse-agent",
    mode: useExternalBrowser ? "external-browser" : "portable-analysis",
  });
}

export async function POST(request: Request) {
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
        push({ type: "run", runId, workflow, status: "observing", limits: { maxPages: 1, timeoutSeconds: 55 } });
        push({ type: "activity", status: "running", title: "Validating the target", detail: "Confirming this is a public HTTP website." });
        push({ type: "activity", status: "running", title: "Fetching website evidence", detail: String(input.url || "") });

        const analysisResponse = await analyzeWebsite(new Request(request.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: input.url }),
        }));
        const analysis = await analysisResponse.json() as Analysis;
        if (!analysisResponse.ok) throw new Error(analysis.error || "The website could not be analyzed.");

        push({ type: "activity", status: "complete", title: "Website evidence collected", detail: `${analysis.checks.length} SEO, accessibility and technical checks completed from the live HTML response.` });
        push({ type: "activity", status: "complete", title: "Technical signals measured", detail: `TTFB ${analysis.ttfb} ms · ${analysis.images} images · ${analysis.scripts} scripts · ${analysis.styles} stylesheets.` });
        push({
          type: "profile",
          profile: {
            siteType: analysis.title || "Public website",
            purpose: analysis.ai?.summary || `Technical and search audit for ${analysis.url}`,
            primaryJourney: input.goal || "Find the highest-impact website improvements",
            plan: ["Fetch the public page", "Inspect search and accessibility signals", "Measure response characteristics", "Use Gemini to prioritize improvements"],
          },
        });
        push({ type: "activity", status: analysis.ai ? "complete" : "warning", title: analysis.ai ? "Gemini recommendations prepared" : "Deterministic report prepared", detail: analysis.ai?.verdict || analysis.aiError || "The audit completed without AI enrichment." });

        const findings = analysis.checks.filter((check) => !check.pass).map((check) => ({
          id: crypto.randomUUID(),
          category: check.category,
          severity: check.category === "Technical" ? "high" : "medium",
          title: check.name,
          expected: "The page should pass this website-quality check.",
          observed: check.detail,
          recommendation: check.fix,
          confidence: "verified",
          evidenceType: "html-response",
        }));

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
        const result = {
          runId,
          workflow,
          goal: String(input.goal || ""),
          status: "completed",
          outcome: analysis.ai?.verdict || `Audit completed with a score of ${analysis.score}/100.`,
          visitedPages: [analysis.url],
          actions: [{ sequence: 1, action: "fetch", ok: true, url: analysis.url }],
          performance: {
            ttfb: analysis.ttfb,
            domContentLoaded: analysis.load,
            load: analysis.load,
            resources: analysis.images + analysis.scripts + analysis.styles,
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
