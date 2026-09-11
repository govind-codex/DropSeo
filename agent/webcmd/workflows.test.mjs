import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executeWorkflow } from "./executor.mjs";
import { findWorkflow, learnWorkflow, listWorkflows, recordWorkflowResult, saveWorkflow } from "./workflows.mjs";

test("learns, finds, and records workflow regressions", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sitepulse-workflows-"));
  const previousDirectory = process.env.WEBCMD_WORKFLOW_DIR;
  process.env.WEBCMD_WORKFLOW_DIR = directory;
  try {
    const learned = learnWorkflow({
      domain: "example.com",
      goal: "Find pricing",
      runType: "journey",
      startUrl: "https://example.com/",
      version: "0.8.4",
      history: [{ action: "click", ok: true, changed: true, elementText: "Pricing", target: { role: "link", name: "Pricing", href: "/pricing" }, message: "Pricing opened." }],
    });
    assert.ok(learned);
    assert.equal(learned.steps.length, 3);
    await saveWorkflow(learned);
    assert.equal((await listWorkflows("example.com")).length, 1);
    assert.equal((await findWorkflow("example.com", "Find pricing", "journey"))?.id, learned.id);

    const passed = await recordWorkflowResult(learned, { passed: true, finalUrl: "https://example.com/pricing", message: "Passed" });
    assert.equal(passed.regression, false);
    assert.equal(passed.workflow.status, "validated");
    const failed = await recordWorkflowResult(passed.workflow, { passed: false, finalUrl: "https://example.com/", message: "CTA missing" });
    assert.equal(failed.regression, true);
    assert.equal(failed.workflow.status, "stale");
    assert.equal(failed.workflow.successRate, 2 / 3);
  } finally {
    if (previousDirectory === undefined) delete process.env.WEBCMD_WORKFLOW_DIR;
    else process.env.WEBCMD_WORKFLOW_DIR = previousDirectory;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("rejects consequential actions before starting Webcmd", async () => {
  await assert.rejects(() => executeWorkflow({ id: "unsafe-flow", steps: [{ type: "click", description: "Pay now", target: { role: "button", name: "Pay now" } }] }, "https://example.com"), /prohibited consequential action/);
});
