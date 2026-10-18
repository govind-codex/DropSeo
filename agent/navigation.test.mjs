import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import test from "node:test";
import { chromium } from "playwright-core";
import { navigatePage } from "./navigation.mjs";

test("navigation handles slow and unreachable documents in Chromium", async (t) => {
  const candidates = [process.env.CHROME_EXECUTABLE_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) {
    if (await fs.access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
  }
  if (!executablePath) return t.skip("Install Chromium or set CHROME_EXECUTABLE_PATH for browser regression coverage.");
  let retryRequests = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/never" || req.url === "/stalled.js") return;
    if (req.url === "/retry" && ++retryRequests === 1) return;
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/csp") res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; require-trusted-types-for 'script'");
    if (req.url === "/delayed") return res.end('<body><script>window.requestAnimationFrame = () => 0; setTimeout(() => document.body.append(Object.assign(document.createElement("h1"), {textContent: "Content rendered later"})), 350);</script></body>');
    if (req.url === "/late") return res.end('<body><script>setTimeout(() => document.body.append(Object.assign(document.createElement("h1"), {textContent: "Hydrated content"})), 5500);</script></body>');
    if (req.url === "/denied") { res.statusCode = 403; return res.end(" "); }
    if (req.url === "/limited") { res.statusCode = 429; return res.end(" "); }
    if (req.url === "/slow") return res.end('<h1>Usable content</h1><script src="/stalled.js"></script>');
    if (req.url === "/blank") return res.end("<html><body></body></html>");
    if (req.url === "/error") res.statusCode = 503;
    res.end("<h1>Current document</h1>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const browser = await chromium.launch({ executablePath, headless: true });
  t.after(() => browser.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const options = { responseTimeoutMs: 800, domTimeoutMs: 200, contentTimeoutMs: 200 };
  async function withPage(run) {
    const page = await browser.newPage();
    try { await run(page); } finally { await page.close(); }
  }

  await t.test("normal document completes without warnings", () => withPage(async (page) => {
    const warnings = [];
    const result = await navigatePage(page, origin, { ...options, onWarning: (item) => warnings.push(item) });
    assert.equal(result.partialLoad, false);
    assert.equal(result.response.status(), 200);
    assert.deepEqual(warnings, []);
  }));
  await t.test("strict content security policies do not hide readable content", () => withPage(async (page) => {
    await navigatePage(page, `${origin}/csp`, options);
    assert.equal(await page.locator("h1").innerText(), "Current document");
  }));
  await t.test("delayed content is detected even when animation frames stop", () => withPage(async (page) => {
    await navigatePage(page, `${origin}/delayed`, { ...options, contentTimeoutMs: 1_000 });
    assert.equal(await page.locator("h1").innerText(), "Content rendered later");
  }));
  await t.test("default content budget allows hydration beyond five seconds", () => withPage(async (page) => {
    await navigatePage(page, `${origin}/late`);
    assert.equal(await page.locator("h1").innerText(), "Hydrated content");
  }));
  await t.test("access refusals identify the HTTP status instead of reporting blank content", () => withPage(async (page) => {
    await assert.rejects(navigatePage(page, `${origin}/denied`, options), /refused access.*HTTP 403/);
    await assert.rejects(navigatePage(page, `${origin}/limited`, options), /rate-limiting.*HTTP 429/);
  }));
  await t.test("blocked DOMContentLoaded continues only with readable content", () => withPage(async (page) => {
    await assert.rejects(page.goto(`${origin}/slow`, { waitUntil: "domcontentloaded", timeout: 800 }), { name: "TimeoutError" });
    const warnings = [];
    const result = await navigatePage(page, `${origin}/slow`, { ...options, onWarning: (item) => warnings.push(item) });
    assert.equal(result.partialLoad, true);
    assert.equal(await page.locator("h1").innerText(), "Usable content");
    assert.equal(warnings[0].partialLoad, true);
  }));
  await t.test("retries a stalled response exactly once", () => withPage(async (page) => {
    const warnings = [];
    await navigatePage(page, `${origin}/retry`, { ...options, onWarning: (item) => warnings.push(item) });
    assert.equal(retryRequests, 2);
    assert.equal(warnings.length, 1);
  }));
  await t.test("old content cannot satisfy an unreachable new navigation", () => withPage(async (page) => {
    await navigatePage(page, origin, options);
    const warnings = [];
    await assert.rejects(navigatePage(page, `${origin}/never`, { ...options, onWarning: (item) => warnings.push(item) }), /did not respond after two attempts/);
    assert.equal(warnings.length, 1);
  }));
  await t.test("blank document does not become a successful audit", () => withPage(async (page) => {
    await assert.rejects(navigatePage(page, `${origin}/blank`, options), /did not display readable page content/);
  }));
  await t.test("HTTP errors remain available as audit evidence", () => withPage(async (page) => {
    const result = await navigatePage(page, `${origin}/error`, options);
    assert.equal(result.response.status(), 503);
  }));
  await t.test("domain policy failures are never retried", () => withPage(async (page) => {
    let requests = 0;
    await page.route("**/*", (route) => { requests += 1; return route.abort("blockedbyclient"); });
    await assert.rejects(navigatePage(page, origin, options), /ERR_BLOCKED_BY_CLIENT/);
    assert.equal(requests, 1);
  }));
});
