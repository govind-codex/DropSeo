import http from "node:http";
import { browserAvailable, runAgent } from "./worker.mjs";
import { getWebcmdInfo, webcmdRuntimeEnabled } from "./webcmd/index.mjs";

try { process.loadEnvFile?.(".env.local"); } catch {}

const PORT = Number(process.env.PORT || process.env.AGENT_WORKER_PORT || 8788);
const HOST = process.env.AGENT_WORKER_HOST || "0.0.0.0";
const MAX_BODY = 64_000;
const MAX_CONCURRENT_RUNS = Math.min(4, Math.max(1, Number(process.env.AGENT_MAX_CONCURRENT_RUNS) || 1));
let activeRuns = 0;
const waitingRuns = [];

function acquireRunSlot() {
  if (activeRuns < MAX_CONCURRENT_RUNS) {
    activeRuns += 1;
    return Promise.resolve(() => releaseRunSlot());
  }
  return new Promise((resolve) => waitingRuns.push(resolve)).then(() => {
    activeRuns += 1;
    return () => releaseRunSlot();
  });
}

function releaseRunSlot() {
  activeRuns = Math.max(0, activeRuns - 1);
  waitingRuns.shift()?.();
}

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(value));
}

function emit(res, event) {
  if (!res.destroyed) res.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw new Error("Request is too large.");
  }
  return JSON.parse(body || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,authorization", "access-control-allow-methods": "GET,POST,OPTIONS" });
    return res.end();
  }
  // Keep readiness public so Railway can verify the deployment. Only /run is
  // protected by the shared worker token.
  if (req.method === "GET" && req.url === "/health") {
    const webcmdEnabled = webcmdRuntimeEnabled();
    const [browser, webcmd] = await Promise.all([
      browserAvailable(),
      webcmdEnabled ? getWebcmdInfo() : Promise.resolve({ available: false, version: null, reason: "Disabled by WEBCMD_ENABLED." }),
    ]);
    return sendJson(res, browser ? 200 : 503, { ok: browser, browser, webcmd });
  }
  if (req.method === "POST" && req.url === "/run") {
    if (process.env.AGENT_WORKER_TOKEN && req.headers.authorization !== `Bearer ${process.env.AGENT_WORKER_TOKEN}`) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
    try {
      const input = await readBody(req);
      res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform", "access-control-allow-origin": "*", connection: "keep-alive" });
      if (activeRuns >= MAX_CONCURRENT_RUNS) emit(res, { type: "activity", status: "running", title: "Run queued", detail: "The browser worker is finishing another investigation before this one starts." });
      const release = await acquireRunSlot();
      try { await runAgent(input, res); }
      finally { release(); }
      return res.end();
    } catch (error) {
      if (res.headersSent) { emit(res, { type: "error", error: error instanceof Error ? error.message : "Agent run failed." }); return res.end(); }
      return sendJson(res, 400, { error: error instanceof Error ? error.message : "Agent run failed." });
    }
  }
  return sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => console.log(`DropSeo agent worker ready at http://${HOST}:${PORT}`));

function shutdown(signal) {
  console.log(`${signal} received; stopping DropSeo agent worker.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
