import { runAgent } from "../../../../agent/worker.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

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
        void runAgent(input, (event: Record<string, unknown>) => {
          if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }).then(() => {
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
