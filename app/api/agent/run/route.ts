import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const workerUrl = env.AGENT_WORKER_URL || process.env.AGENT_WORKER_URL;
  if (!workerUrl) {
    return Response.json(
      { error: "The browser agent worker is not configured. Run the local agent or set AGENT_WORKER_URL." },
      { status: 503 },
    );
  }

  try {
    const payload = await request.text();
    const token = env.AGENT_WORKER_TOKEN || process.env.AGENT_WORKER_TOKEN;
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

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to reach the browser agent." },
      { status: 502 },
    );
  }
}
