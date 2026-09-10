import http from "node:http";
import { browserAvailable, runAgent } from "./worker.mjs";

try { process.loadEnvFile?.(".env.local"); } catch {}

const PORT = Number(process.env.AGENT_WORKER_PORT || 8788);
const MAX_BODY = 64_000;

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
  if (process.env.AGENT_WORKER_TOKEN && req.headers.authorization !== `Bearer ${process.env.AGENT_WORKER_TOKEN}`) return sendJson(res, 401, { error: "Unauthorized." });
  if (req.method === "GET" && req.url === "/health") return sendJson(res, 200, { ok: true, browser: await browserAvailable(), model: process.env.GEMINI_MODEL || "gemini-3.6-flash" });
  if (req.method === "POST" && req.url === "/run") {
    try {
      const input = await readBody(req);
      res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform", "access-control-allow-origin": "*", connection: "keep-alive" });
      await runAgent(input, res);
      return res.end();
    } catch (error) {
      if (res.headersSent) { emit(res, { type: "error", error: error instanceof Error ? error.message : "Agent run failed." }); return res.end(); }
      return sendJson(res, 400, { error: error instanceof Error ? error.message : "Agent run failed." });
    }
  }
  return sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => console.log(`Sitepulse agent worker ready at http://127.0.0.1:${PORT}`));
