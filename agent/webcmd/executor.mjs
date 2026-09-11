import { runBrowserProgram } from "./client.mjs";

const PROHIBITED_ACTION = /\b(buy|purchase|pay|place order|delete|remove account|send message|submit|confirm booking|password|otp|card|payment)\b/i;

function assertSafeWorkflow(workflow, origin) {
  if (!workflow || !Array.isArray(workflow.steps) || workflow.steps.length > 20) throw new Error("The stored workflow is invalid or too large.");
  for (const step of workflow.steps) {
    if (PROHIBITED_ACTION.test(`${step.description || ""} ${step.target?.name || ""}`)) throw new Error("The workflow contains a prohibited consequential action.");
    if (step.type === "type" && (!step.value || step.value.length > 120 || PROHIBITED_ACTION.test(step.description))) throw new Error("The workflow contains unsafe text entry.");
    if (step.url) {
      const candidate = new URL(step.url, origin);
      const base = new URL(origin).hostname;
      if (!["http:", "https:"].includes(candidate.protocol) || candidate.username || candidate.password || candidate.port || candidate.hostname !== base) throw new Error("The workflow attempts to leave the explicitly approved host.");
    }
    if (step.target?.href) {
      const linked = new URL(step.target.href, origin);
      if (!["http:", "https:"].includes(linked.protocol) || linked.username || linked.password || linked.port || linked.hostname !== new URL(origin).hostname) throw new Error("The workflow target leaves the explicitly approved host.");
    }
  }
}

function browserProgram(workflow, origin, exploreOnly = false) {
  const serializedWorkflow = JSON.stringify(workflow).replace(/</g, "\\u003c");
  const serializedOrigin = JSON.stringify(origin);
  return `
const workflow = ${serializedWorkflow};
const approvedOrigin = ${serializedOrigin};
const resolveUrl = (value) => {
  if (value === approvedOrigin || value.startsWith(approvedOrigin + "/") || value.startsWith(approvedOrigin + "?") || value.startsWith(approvedOrigin + "#")) return value;
  if (value.startsWith("/")) return approvedOrigin + value;
  return approvedOrigin + "/" + value.replace(/^\\.\\//, "");
};
const allowed = (value) => value === approvedOrigin || value.startsWith(approvedOrigin + "/") || value.startsWith(approvedOrigin + "?") || value.startsWith(approvedOrigin + "#");
page.on("dialog", dialog => dialog.dismiss().catch(() => {}));
page.on("download", download => download.cancel().catch(() => {}));
const results = [];
const locate = (target = {}) => {
  if (target.role && target.name) return page.getByRole(target.role, { name: target.name, exact: true }).first();
  if (target.href) return page.locator("a[href=" + JSON.stringify(target.href) + "]").first();
  if (target.selector) return page.locator(target.selector).first();
  throw new Error("No reusable target was stored for this step.");
};
for (const [index, step] of workflow.steps.entries()) {
  const beforeUrl = page.url();
  const beforeText = (await page.locator("body").innerText().catch(() => "")).replace(/\\s+/g, " ").slice(0, 1500);
  try {
    if (step.type === "navigate") {
      const destination = resolveUrl(step.url);
      if (!allowed(destination)) throw new Error("Navigation blocked by domain policy.");
      await page.goto(destination, { waitUntil: "domcontentloaded", timeout: 15000 });
    } else if (step.type === "click") {
      const target = locate(step.target);
      const href = await target.getAttribute("href").catch(() => null);
      if (href && !allowed(resolveUrl(href))) throw new Error("Click navigation blocked by domain policy.");
      await target.click({ timeout: 7000 });
      await page.waitForTimeout(700);
      if (!allowed(page.url())) throw new Error("The interaction left the approved origin.");
    } else if (step.type === "type") {
      await locate(step.target).fill(step.value, { timeout: 7000 });
    } else if (step.type === "wait") {
      await page.waitForTimeout(Math.min(3000, Math.max(50, step.durationMs || 500)));
    } else if (step.type === "verify") {
      if (!results.some(item => item.type !== "navigate" && item.changed)) throw new Error("No interaction produced the expected page change.");
    }
    const afterText = (await page.locator("body").innerText().catch(() => "")).replace(/\\s+/g, " ").slice(0, 1500);
    results.push({ index, type: step.type, ok: true, changed: page.url() !== beforeUrl || afterText !== beforeText, url: page.url(), description: step.description });
  } catch (error) {
    results.push({ index, type: step.type, ok: false, changed: false, url: page.url(), description: step.description, error: String(error && error.message || error).slice(0, 300) });
    break;
  }
}
const links = await page.locator("a[href]").evaluateAll((nodes) => nodes.slice(0, 80).map((node) => ({ text: (node.textContent || node.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 100), href: node.href })).filter(item => item.text));
const controls = await page.locator("button,input,[role=button]").evaluateAll((nodes) => nodes.slice(0, 60).map((node) => ({ text: (node.textContent || node.getAttribute("aria-label") || node.getAttribute("placeholder") || "").replace(/\\s+/g, " ").trim().slice(0, 100), role: node.getAttribute("role") || node.tagName.toLowerCase(), type: node.getAttribute("type") || "" })).filter(item => item.text));
return { ok: results.every(item => item.ok), finalUrl: page.url(), title: await page.title(), results, links, controls, explored: ${exploreOnly ? "true" : "false"} };
`;
}

export async function exploreWebsite(url) {
  const target = new URL(url);
  const workflow = { steps: [{ type: "navigate", description: "Open website", url: target.href }] };
  return runBrowserProgram(browserProgram(workflow, target.origin, true), { name: `explore-${target.hostname.replace(/[^a-z0-9]/gi, "-").slice(0, 35)}`, browserTimeoutMs: 28_000 });
}

export async function executeWorkflow(workflow, origin) {
  assertSafeWorkflow(workflow, origin);
  const output = await runBrowserProgram(browserProgram(workflow, origin), { name: `workflow-${workflow.id.slice(0, 8)}`, browserTimeoutMs: 35_000 });
  return {
    passed: Boolean(output?.ok && output.results?.every((item) => item.ok)),
    finalUrl: output?.finalUrl,
    message: output?.ok ? "Known Webcmd workflow completed successfully." : output?.results?.find((item) => !item.ok)?.error || "Known Webcmd workflow failed.",
    output,
  };
}

export async function validateWorkflow(workflow, origin) {
  const output = await executeWorkflow(workflow, origin);
  const failed = output.output?.results?.find((item) => !item.ok);
  return {
    ...output,
    message: output.passed
      ? `All ${workflow.steps.length} stored steps completed.`
      : failed?.error || `The stored workflow failed at ${failed?.description || "an unknown step"}.`,
  };
}
