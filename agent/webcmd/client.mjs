import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_OUTPUT = 1_500_000;

function commandSpec() {
  if (process.env.WEBCMD_BIN) return { command: process.env.WEBCMD_BIN, prefix: [] };
  const entry = path.join(process.cwd(), "node_modules", "@agentrhq", "webcmd", "dist", "src", "main.js");
  return { command: process.execPath, prefix: [entry] };
}

function parseStructuredOutput(stdout) {
  const text = stdout.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch {}
  }
  throw new Error("Webcmd returned output that was not valid JSON.");
}

export class WebcmdError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "WebcmdError";
    this.code = details.code;
    this.stderr = details.stderr;
    this.timedOut = Boolean(details.timedOut);
  }
}

export async function runWebcmdCommand(args, options = {}) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
    throw new TypeError("Webcmd arguments must be an array of safe strings.");
  }
  const { command, prefix } = commandSpec();
  if (!process.env.WEBCMD_BIN) await fs.access(prefix[0]).catch(() => { throw new WebcmdError("Webcmd is not installed in this project.", { code: "NOT_INSTALLED" }); });
  const timeoutMs = Math.min(120_000, Math.max(1_000, Number(options.timeoutMs) || Number(process.env.WEBCMD_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS));
  const maxOutput = Math.min(5_000_000, Math.max(10_000, Number(options.maxOutput) || DEFAULT_MAX_OUTPUT));

  return new Promise((resolve, reject) => {
    let timer;
    const child = spawn(command, [...prefix, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      windowsHide: true,
      shell: false,
      stdio: [options.stdin == null ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const append = (current, chunk) => `${current}${chunk}`.slice(-maxOutput);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk.toString()); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk.toString()); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new WebcmdError(`Webcmd could not start: ${error.message}`, { code: error.code, stderr }));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) return reject(new WebcmdError(stderr.trim() || `Webcmd exited with code ${code}.`, { code, stderr }));
      try { resolve(options.parseJson === false ? stdout.trim() : parseStructuredOutput(stdout)); }
      catch (error) { reject(new WebcmdError(error.message, { code, stderr })); }
    });
    if (options.stdin != null) child.stdin.end(String(options.stdin));
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 1_000).unref();
      reject(new WebcmdError(`Webcmd timed out after ${timeoutMs} ms.`, { code: "TIMEOUT", stderr, timedOut: true }));
    }, timeoutMs);
    timer.unref();
  });
}

export async function getWebcmdInfo() {
  try {
    const version = await runWebcmdCommand(["--version"], { parseJson: false, timeoutMs: 8_000, maxOutput: 20_000 });
    return { available: true, version: version.trim() };
  } catch (error) {
    return { available: false, version: null, reason: error instanceof Error ? error.message : "Webcmd is unavailable." };
  }
}

export async function withWebcmdSession(name, task, options = {}) {
  const profile = options.profile || process.env.WEBCMD_PROFILE || "dropseo";
  await runWebcmdCommand(["--profile", profile, "profile", "create", profile, "-f", "json"], { timeoutMs: 15_000 }).catch(() => null);
  const created = await runWebcmdCommand(["--profile", profile, "session", "create", name, "-f", "json"], { timeoutMs: 20_000 });
  const sessionId = created?.id;
  if (!sessionId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,100}$/.test(sessionId)) throw new WebcmdError("Webcmd did not return a valid session ID.");
  try {
    return await task({ profile, sessionId });
  } finally {
    await runWebcmdCommand(["--profile", profile, "session", "close", sessionId, "-f", "json"], { timeoutMs: 12_000 }).catch(() => null);
  }
}

export async function runBrowserProgram(program, options = {}) {
  if (typeof program !== "string" || program.length > 250_000) throw new TypeError("Webcmd browser programs must be bounded strings.");
  const response = await withWebcmdSession(options.name || `dropseo-${Date.now().toString(36)}`, ({ profile, sessionId }) => runWebcmdCommand([
    "--profile", profile,
    "--session", sessionId,
    "browser", "run",
    "--stdin",
    "--timeout", String(Math.ceil((options.browserTimeoutMs || 30_000) / 1000)),
    "--max-output", String(options.maxOutput || 1_000_000),
    "--no-snapshot-diff",
    "-f", "json",
  ], { stdin: program, timeoutMs: options.timeoutMs || 45_000, maxOutput: options.maxOutput || 1_500_000 }));
  return response?.result ?? response;
}
