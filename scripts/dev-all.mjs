import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const workerPort = process.env.AGENT_WORKER_PORT || "8788";
const webEnvironment = {
  ...process.env,
  AGENT_BROWSER_MODE: "external",
  AGENT_WORKER_URL: process.env.AGENT_WORKER_URL || `http://127.0.0.1:${workerPort}`,
};
const children = [
  spawn(process.execPath, ["agent/server.mjs"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev:web"], { stdio: "inherit", env: webEnvironment, shell: process.platform === "win32" }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 150);
}

for (const child of children) child.on("exit", (code) => { if (!stopping && code) stop(code); });
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
