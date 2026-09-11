import { learnWorkflow, saveWorkflow, rememberWorkflowInWebcmd } from "./workflows.mjs";

/** Replace a stale workflow only after Playwright has found a new safe path. */
export async function recoverWorkflow({ workflow, domain, goal, runType, startUrl, history, version, syncNative = true }) {
  const recovered = learnWorkflow({ domain, goal, runType, startUrl, history, version, existing: workflow });
  if (!recovered) return null;
  const saved = await saveWorkflow({ ...recovered, status: "learned" });
  if (syncNative) await rememberWorkflowInWebcmd(saved).catch(() => null);
  return saved;
}
