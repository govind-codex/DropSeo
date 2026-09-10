import path from "node:path";
import { pathToFileURL } from "node:url";

export const runtime = "nodejs";
export const maxDuration = 300;

export function GET() {
  return Response.json({ ok: true, service: "sitepulse-agent", runtime: "nodejs" });
}

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const workerUrl = process.env.AGENT_WORKER_URL?.trim();
    const useIntegratedBrowser = process.env.AGENT_BROWSER_MODE === "integrated" || !workerUrl;

    if (!useIntegratedBrowser) {
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
        return Response.json(
          { error: message || "The browser worker could not start this run." },
          { status: upstream.status || 502 },
        );
      }

      return new Response(upstream.body, { headers: streamHeaders() });
    }

    const input = JSON.parse(payload || "{}");
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      start(controller) {
        const workerUrl = pathToFileURL(path.join(process.cwd(), "agent", "worker.mjs")).href;
        // Keep the browser runtime outside Turbopack's route-module graph; Vercel
        // includes it through outputFileTracingIncludes and Node loads it here.
        const importModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{ runAgent: (input: unknown, emit: (event: Record<string, unknown>) => void) => Promise<void> }>;
        void importModule(workerUrl).then(({ runAgent }) => runAgent(input, (event: Record<string, unknown>) => {
          if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        })).then(() => {
          if (!closed) controller.close();
        }).catch((error: unknown) => {
          if (!closed) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Agent run failed." })}\n`));
            controller.close();
          }
        });
      },
      cancel() { closed = true; },
    });
    return new Response(stream, { headers: streamHeaders() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to start the browser agent." },
      { status: 400 },
    );
  }
}

function streamHeaders() {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
  };
}
