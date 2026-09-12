import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { isLearnedWorkflow } from "./types.mjs";
import { runWebcmdCommand } from "./client.mjs";

const domainWrites = new Map();

function memoryDirectory() {
  if (process.env.WEBCMD_WORKFLOW_DIR) return path.resolve(process.env.WEBCMD_WORKFLOW_DIR);
  const base = process.env.VERCEL === "1" ? path.join(os.tmpdir(), "dropseo") : path.join(process.cwd(), "outputs");
  return path.join(base, "workflows");
}

function domainFile(domain) {
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, "-").slice(0, 120);
  const suffix = createHash("sha256").update(domain).digest("hex").slice(0, 10);
  return path.join(memoryDirectory(), `${safe}-${suffix}.json`);
}

export async function listWorkflows(domain) {
  try {
    const data = JSON.parse(await fs.readFile(domainFile(domain), "utf8"));
    return Array.isArray(data) ? data.filter(isLearnedWorkflow) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeWorkflow(workflow) {
  if (!isLearnedWorkflow(workflow)) throw new TypeError("Invalid learned workflow.");
  const items = await listWorkflows(workflow.domain);
  const index = items.findIndex((item) => item.id === workflow.id || (item.runType === workflow.runType && item.goal.toLowerCase() === workflow.goal.toLowerCase()));
  if (index >= 0) items[index] = workflow; else items.push(workflow);
  await fs.mkdir(memoryDirectory(), { recursive: true });
  await fs.writeFile(domainFile(workflow.domain), JSON.stringify(items, null, 2), "utf8");
  return workflow;
}

export async function saveWorkflow(workflow) {
  const previous = domainWrites.get(workflow?.domain) || Promise.resolve();
  const pending = previous.catch(() => null).then(() => writeWorkflow(workflow));
  domainWrites.set(workflow?.domain, pending);
  try { return await pending; }
  finally { if (domainWrites.get(workflow?.domain) === pending) domainWrites.delete(workflow?.domain); }
}

export async function updateWorkflow(workflow) {
  return saveWorkflow({ ...workflow, updatedAt: new Date().toISOString() });
}

function goalScore(candidate, goal, runType) {
  let score = candidate.runType === runType ? 4 : 0;
  const wanted = new Set(goal.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  const known = new Set(candidate.goal.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  for (const word of wanted) if (known.has(word)) score += 1;
  if (!goal && !candidate.goal) score += 3;
  if (candidate.status === "validated") score += 2;
  return score;
}

export async function findWorkflow(domain, goal, runType) {
  const workflows = await listWorkflows(domain);
  return workflows
    .filter((item) => item.status !== "failed")
    .map((item) => ({ item, score: goalScore(item, goal, runType) }))
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score || b.item.successRate - a.item.successRate)[0]?.item || null;
}

export async function getWorkflow(domain, id) {
  if (!id) return null;
  return (await listWorkflows(domain)).find((item) => item.id === id) || null;
}

export function learnWorkflow({ domain, goal, runType, startUrl, history, version, existing }) {
  const actionable = history.filter((item) => item.ok && item.changed && ["click", "type", "navigate"].includes(item.action));
  if (!actionable.length) return null;
  const now = new Date().toISOString();
  const steps = [
    { type: "navigate", description: "Open the workflow entry page", url: startUrl, expectedOutcome: `Remain on ${domain}` },
    ...actionable.map((item) => ({
      type: item.action,
      description: item.elementText ? `${item.action} ${item.elementText}` : item.rationale || item.action,
      ...(item.action === "navigate" ? { url: item.url } : {}),
      ...(item.target ? { target: item.target } : {}),
      ...(item.action === "type" && item.value ? { value: item.value } : {}),
      expectedOutcome: item.message,
    })),
    { type: "verify", description: "Confirm the journey reached a responsive state", expectedOutcome: history.at(-1)?.message || "The page changed after the journey." },
  ];
  return {
    id: existing?.id || randomUUID(),
    domain,
    name: goal ? goal.slice(0, 100) : `${runType} primary journey`,
    goal,
    runType,
    steps,
    status: "learned",
    successRate: existing?.successRate ?? 1,
    attempts: existing?.attempts ?? 1,
    successes: existing?.successes ?? 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastValidatedAt: existing?.lastValidatedAt,
    lastResult: existing?.lastResult,
    webcmd: { provider: "webcmd", mode: "browser-run", version, profile: process.env.WEBCMD_PROFILE || "dropseo" },
  };
}

export async function recordWorkflowResult(workflow, result) {
  const previousPassed = workflow.lastResult?.passed === true;
  const attempts = workflow.attempts + 1;
  const successes = workflow.successes + (result.passed ? 1 : 0);
  const now = new Date().toISOString();
  const updated = {
    ...workflow,
    status: result.passed ? "validated" : "stale",
    attempts,
    successes,
    successRate: successes / attempts,
    updatedAt: now,
    ...(result.passed ? { lastValidatedAt: now } : {}),
    lastResult: { passed: result.passed, at: now, finalUrl: result.finalUrl, message: result.message },
  };
  await saveWorkflow(updated);
  return { workflow: updated, regression: previousPassed && !result.passed };
}

export async function rememberWorkflowInWebcmd(workflow) {
  const summary = [
    `## DropSeo learned workflow: ${workflow.name}`,
    `Goal: ${workflow.goal || workflow.runType}`,
    `Workflow ID: ${workflow.id}`,
    ...workflow.steps.map((step, index) => `${index + 1}. ${step.description}${step.expectedOutcome ? ` — expected: ${step.expectedOutcome}` : ""}`),
  ].join("\n").slice(0, 4_000);
  return runWebcmdCommand(["site", "note", "add", workflow.domain, "--text", summary, "--author", "dropseo", "-f", "json"], { timeoutMs: 12_000 });
}
