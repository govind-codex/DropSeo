// Local acceptance harness. Start the isolated server described in docs/launch-review.md.
// This harness uses signed TEST sessions and labeled TEST fixtures, never production accounts.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { SignJWT, jwtVerify } from "jose";
import axe from "axe-core";

const origin = process.env.LAUNCH_TEST_ORIGIN || "http://localhost:3001";
assert.equal(new URL(origin).hostname, "localhost", "Acceptance fixtures may only run against localhost.");
const directory = resolve(".data/launch-review");
const output = resolve(".data/launch-review-qa");
await mkdir(directory, { recursive: true });
await mkdir(output, { recursive: true });
const secret = new TextEncoder().encode("launch-review-test-only-secret-32-characters-long");
const userId = `launch-review-${crypto.randomUUID()}`;
const now = new Date().toISOString();
const finding = { id: "title-fixture", category: "Technical", severity: "high", title: "Title missing (TEST FIXTURE)", expected: "One descriptive document title", observed: "The test fixture has no title element", recommendation: "Add a descriptive title", confidence: "verified", evidenceType: "document-check", affectedUrls: ["https://example.com/pricing"], evidence: [{ url: "https://example.com/pricing", detail: "TEST FIXTURE evidence: <head></head>" }] };
const theory = { ...finding, id: "theory-fixture", title: "Possible visitor friction (TEST FIXTURE)", category: "AI strategy", confidence: "hypothesis", severity: "medium" };
const result = { runId: "test-browser-fixture", workflow: "autonomous", completedAt: now, goal: "Find pricing", outcome: "TEST FIXTURE: Review the title check", visitedPages: ["https://example.com/pricing"], actions: [{ action: "inspect", url: "https://example.com/pricing", ok: true }], performance: { ttfb: 40, domContentLoaded: 100, load: 100, resources: 3, vitals: { lcp: 0, cls: 0, longTasks: 0 } }, findings: [theory, finding], checkEvidence: [{ url: "https://example.com/pricing", checks: [{ name: finding.title, pass: false, detail: finding.evidence[0].detail }] }], safety: { blockedActions: 0 }, durationMs: 1500 };
function record(status, extras = {}) {
  return { id: crypto.randomUUID(), userId, url: "https://example.com/pricing", workflow: "autonomous", goal: "Find pricing", status, createdAt: now, updatedAt: now, events: [{ type: "activity", title: "TEST FIXTURE: Document inspected", detail: "https://example.com/pricing", status: "complete", at: now }], ...extras };
}
const completed = record("completed", { result });
const running = record("running");
const queued = record("queued");
const failed = record("failed", { error: "TEST FIXTURE: Website returned HTTP 503. Retry with another public page." });
const verification = record("completed", { referenceId: completed.id, findingId: finding.id, workflow: "verify", result: { ...result, findings: [], verifiedAt: now, checkEvidence: [{ url: "https://example.com/pricing", checks: [{ name: finding.title, pass: true }] }], comparison: { referenceId: completed.id, issues: [{ finding, status: "Fixed", detail: "The original check passed on the affected page." }] } } });
async function save(value) {
  // Atomic replacement mirrors the development persistence contract.
  const { rename } = await import("node:fs/promises");
  const target = resolve(directory, `${value.id}.json`);
  const temporary = `${target}.fixture.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, target);
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const evidence = { widths: [], accessibility: [], scenarios: [], screenshots: [], consoleErrors: [] };
async function navigate(targetPage, url) {
  for (let attempt = 0; ; attempt++) {
    try { return await targetPage.goto(url, { waitUntil: "domcontentloaded" }); }
    catch (error) {
      if (attempt >= 2 || !String(error).includes("ERR_ABORTED")) throw error;
      await targetPage.waitForTimeout(150);
    }
  }
}
page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
try {
  await page.goto(origin);
  await page.getByRole("button", { name: "Investigate my website", exact: true }).click();
  assert.match(await page.locator("#start-error").innerText(), /Enter the website/);
  await page.getByLabel("Website URL", { exact: true }).fill("ftp://example.com");
  await page.getByRole("button", { name: "Investigate my website", exact: true }).click();
  assert.match(await page.locator("#start-error").innerText(), /HTTP or HTTPS/);
  await page.getByLabel("Website URL", { exact: true }).fill("https://example.com/pricing");
  await page.getByLabel("Investigation goal", { exact: true }).selectOption("journey");
  await page.getByLabel("What should a visitor be able to do?", { exact: true }).fill("Find a plan");
  await context.route("**/api/auth/google?*", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    assert.equal(new URL(response.headers().location).hostname, "accounts.google.com");
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>TEST FIXTURE: Google sign-in boundary</h1>" });
  });
  await page.getByRole("button", { name: "Investigate my website", exact: true }).click();
  await page.waitForURL("**/api/auth/google?*");
  const flowCookie = (await context.cookies(origin)).find((cookie) => cookie.name === "dropseo-oauth");
  const flow = (await jwtVerify(flowCookie.value, secret, { issuer: "dropseo", audience: "oauth" })).payload;
  assert.equal(new URL(flow.returnTo, origin).searchParams.get("goal"), "Find a plan");
  assert.equal(new URL(flow.returnTo, origin).searchParams.get("url"), "https://example.com/pricing");
  await context.unroute("**/api/auth/google?*");
  evidence.scenarios.push("Homepage invalid/valid URL and signed OAuth intent passed; Google provider boundary intercepted.");

  const token = await new SignJWT({ name: "Launch Review TEST", email: "launch-review@example.com" }).setSubject(userId).setIssuer("dropseo").setAudience("session").setIssuedAt().setExpirationTime("1h").setProtectedHeader({ alg: "HS256" }).sign(secret);
  await context.addCookies([{ name: "dropseo-session", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`${origin}/dashboard`);
  await page.getByRole("heading", { name: "Start your first investigation" }).waitFor();
  assert.equal(await page.getByLabel("Website to investigate").inputValue(), "");
  evidence.scenarios.push("First-use guided empty state passed.");
  for (const item of [completed, running, queued, failed, verification]) await save(item);

  let continuedInput;
  await page.route("**/api/agent/run", (route) => { continuedInput = route.request().postDataJSON(); return route.fulfill({ status: 200, headers: { "X-Investigation-ID": running.id }, contentType: "application/x-ndjson", body: JSON.stringify({ type: "saved", investigationId: running.id }) + "\n" }); });
  await page.goto(`${origin}/dashboard?${new URLSearchParams({url: "https://example.com/pricing", workflow: "journey", goal: "Find a plan", continue: "1"})}`);
  await page.waitForURL(`**/investigations/${running.id}`);
  assert.equal(continuedInput.url, "https://example.com/pricing");
  assert.equal(continuedInput.workflow, "journey");
  assert.equal(continuedInput.goal, "Find a plan");
  await page.unroute("**/api/agent/run");
  evidence.scenarios.push("Authenticated continuation automatically starts the chosen investigation (test run response).");
  const routes = ["/", "/sample-report", "/dashboard", "/investigations", `/investigations/${completed.id}`, `/investigations/${running.id}`, `/investigations/${queued.id}`, `/investigations/${failed.id}`, `/investigations/${verification.id}`, "/settings", "/privacy", "/terms", "/help", "/contact", "/checkout"];
  async function inspectWidth(width) {
    const matrixPage = await context.newPage();
    matrixPage.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
    try {
    await matrixPage.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await navigate(matrixPage, origin + route);
      await matrixPage.locator("h1").first().waitFor();
      const overflow = await matrixPage.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders: Array.from(document.querySelectorAll("body *")).filter((element) => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map((element) => element.className) }));
      evidence.widths.push({ width, route, ...overflow });
      if (width === 320 || width === 1440) {
        await matrixPage.evaluate(axe.source);
        const scan = await matrixPage.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
        evidence.accessibility.push({ width, route, violations: scan.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })) });
        if (["/", "/sample-report", "/dashboard", `/investigations/${completed.id}`].includes(route)) {
          const path = resolve(output, `${route === "/" ? "home" : route === "/sample-report" ? "sample" : route === "/dashboard" ? "dashboard" : "report"}-${width}.png`);
          await matrixPage.screenshot({ path, fullPage: true }); evidence.screenshots.push(path);
        }
      }
    }
    console.log(`Viewport ${width}: ${routes.length} routes checked`);
    await writeFile(resolve(output, "browser-evidence.json"), JSON.stringify(evidence, null, 2));
    } finally { await matrixPage.close(); }
  }
  for (const batch of [[320,375],[390,430],[768,1440]]) await Promise.all(batch.map(inspectWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/investigations/${completed.id}`);
  await page.getByLabel(`Open evidence for ${finding.title}`, { exact: true }).click();
  await page.locator(`#finding-${finding.id} details[open]`).waitFor();
  assert.match(await page.locator(`#finding-${finding.id} details`).innerText(), /TEST FIXTURE evidence/);
  assert.equal(await page.locator(`#finding-${theory.id} button`).count(), 0);
  assert.equal(await page.getByRole("button", { name: `Verify fix for ${finding.title}` }).count(), 1);
  await page.getByLabel("Priority", { exact: true }).selectOption("medium");
  assert.equal(await page.locator(".findings-list article").count(), 1);
  await page.getByLabel("Priority", { exact: true }).selectOption("all");
  evidence.scenarios.push("Finding evidence ownership, unverified theory, severity filtering and supported-action visibility passed.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs(resolve(output, "fixture-report.pdf"));
  evidence.scenarios.push("Browser PDF download passed.");

  // Verification UI uses the saved separate fixture. Backend comparisons run in test:investigations.
  await page.route("**/api/agent/run", (route) => route.fulfill({ status: 200, headers: { "X-Investigation-ID": verification.id }, contentType: "application/x-ndjson", body: JSON.stringify({ type: "saved", investigationId: verification.id }) + "\n" }));
  await page.getByRole("button", { name: `Verify fix for ${finding.title}` }).click();
  await page.waitForURL(`**/investigations/${verification.id}`);
  await page.getByRole("link", { name: "Open original investigation" }).waitFor();
  assert.match(await page.locator(".verification-results").innerText(), /Fixed/);
  assert.deepEqual(JSON.parse(await readFile(resolve(directory, `${completed.id}.json`), "utf8")).result, result);
  await page.unroute("**/api/agent/run");
  evidence.scenarios.push("Verify fix navigation and dated separate comparison passed (test response fixture).");

  await save({ ...running, updatedAt: new Date().toISOString() });
  await page.goto(`${origin}/investigations/${running.id}`);
  await page.reload();
  await page.getByText("Investigation running", { exact: true }).waitFor();
  await page.route(`**/api/investigations/${running.id}`, (route) => route.abort("internetdisconnected"));
  await page.getByText(/Connection lost/).waitFor({ timeout: 15000 });
  await page.unroute(`**/api/investigations/${running.id}`);
  await save({ ...running, status: "completed", updatedAt: new Date().toISOString(), result, events: [...running.events, { type: "complete", result, at: new Date().toISOString() }] });
  await page.getByText("Investigation completed", { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await page.getByText(/Connection lost/).count(), 0);
  await page.getByRole("link", { name: "Open report", exact: true }).click();
  evidence.scenarios.push("Running refresh, network interruption, automatic reconnection and completed report link passed.");
  await page.goto(`${origin}/investigations/${failed.id}`);
  await page.getByRole("link", { name: "Retry as a new investigation" }).click();
  await page.getByLabel("Website to investigate").waitFor();
  assert.equal(await page.getByLabel("Website to investigate").inputValue(), failed.url);
  evidence.scenarios.push("Failed-run retry preserves website and goal.");

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("link", { name: "Settings & help" }).waitFor();
  await page.evaluate(axe.source);
  const menuScan = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  evidence.accessibility.push({width:1440,route:"/dashboard (account menu open)",violations:menuScan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Open profile menu" }).getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Open profile menu");
  evidence.scenarios.push("Account settings links and Escape focus restoration passed.");
  await context.clearCookies();
  await page.goto(`${origin}/login`);
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Login overflow at ${width}`);
    if (width === 320 || width === 1440) {
      await page.evaluate(axe.source);
      const scan = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
      evidence.accessibility.push({width,route:"/login",violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
    }
  }
  await page.goto(origin);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Skip to content");
  await page.keyboard.press("Enter");
  await page.getByLabel("Website URL", { exact: true }).focus();
  const focus = await page.evaluate(() => ({ name: document.activeElement.id, outline: getComputedStyle(document.activeElement).outlineStyle }));
  assert.equal(focus.name, "hero-url"); assert.notEqual(focus.outline, "none");
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  evidence.scenarios.push("Keyboard skip link, input focus visibility and reduced-motion preference passed.");
  await writeFile(resolve(output, "browser-evidence.json"), JSON.stringify(evidence, null, 2));
  const overflowing = evidence.widths.filter((check) => check.scrollWidth > check.width);
  const violations = evidence.accessibility.filter((scan) => scan.violations.length);
  console.log(JSON.stringify({ checks: evidence.widths.length, overflowing, accessibilityViolations: violations, scenarios: evidence.scenarios, consoleErrors: evidence.consoleErrors }, null, 2));
  assert.equal(overflowing.length, 0, "Unintended horizontal overflow remains.");
  assert.equal(violations.length, 0, "Accessibility violations remain.");
  assert.equal(evidence.consoleErrors.length, 0, "Browser errors remain.");
} finally { await writeFile(resolve(output, "browser-evidence.json"), JSON.stringify(evidence, null, 2)); await context.close(); await browser.close(); }
