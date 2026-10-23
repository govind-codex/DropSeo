// Local acceptance harness. Start the isolated server described in docs/launch-review.md.
// This harness uses signed TEST sessions and labeled TEST fixtures, never production accounts.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { SignJWT } from "jose";

const origin = process.env.LAUNCH_TEST_ORIGIN || "http://localhost:3001";
assert.equal(new URL(origin).hostname, "localhost", "Acceptance fixtures may only run against localhost.");
const directory = resolve(".data/launch-review");
const output = resolve(".data/responsive-review");
await mkdir(directory, { recursive: true });
await mkdir(output, { recursive: true });
const secret = new TextEncoder().encode("launch-review-test-only-secret-32-characters-long");
const userId = `launch-review-${crypto.randomUUID()}`;
const now = new Date().toISOString();
const finding = { id: "title-fixture", category: "Technical", severity: "high", title: "Title missing on a long product comparison page (TEST FIXTURE)", expected: "One descriptive document title", observed: "The test fixture has no title element", recommendation: "Add a descriptive title", confidence: "verified", evidenceType: "document-check", affectedUrls: ["https://example.com/pricing"], evidence: [{ url: "https://example.com/pricing", detail: "TEST FIXTURE evidence: <head></head>" }] };
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

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const evidence = { checks: [], issues: [], scenarios: [] };
try {
  const page = await context.newPage();
  for (const width of [320, 768]) {
    await page.setViewportSize({width,height:800});
    await page.goto(origin+'/login?error=cancelled');
    await page.locator('h1').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const token = await new SignJWT({ name: "Responsive Review TEST", email: "responsive-review@example.com" }).setSubject(userId).setIssuer("dropseo").setAudience("session").setIssuedAt().setExpirationTime("1h").setProtectedHeader({alg:"HS256"}).sign(secret);
  await context.addCookies([{name:"dropseo-session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
  for (const item of [completed,running,queued,failed,verification]) await save(item);
  const routes = ['/', '/sample-report', '/dashboard', '/investigations', `/investigations/${completed.id}`, `/investigations/${running.id}`, `/investigations/${queued.id}`, `/investigations/${failed.id}`, `/investigations/${verification.id}`, '/settings', '/privacy', '/terms', '/help', '/contact', '/checkout'];
  for (const width of (process.env.RESPONSIVE_INTERACTIONS_ONLY ? [] : [320,375,430,600,768,1024,1440,1920])) {
    await page.setViewportSize({width,height:900});
    for (const route of routes) {
      await page.goto(origin+route,{waitUntil:'domcontentloaded'});
      await page.locator('h1').first().waitFor();
      const check = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *,header *,nav *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left < -1)&&getComputedStyle(e).position!=='absolute'}).slice(0,8).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,90),text:e.textContent?.slice(0,45)}))}));
      evidence.checks.push({route,...check});
      if(check.scroll>width+1) evidence.issues.push({route,...check});
      if([320,768,1440].includes(width) && ['/', '/dashboard', `/investigations/${completed.id}`].includes(route)) await page.screenshot({path:resolve(output,`${route==='/'?'home':route==='/dashboard'?'dashboard':'report'}-${width}.png`),fullPage:true});
    }
    console.log(`Checked ${routes.length} routes at ${width}px`);
    await writeFile(resolve(output,process.env.RESPONSIVE_INTERACTIONS_ONLY ? 'interaction-evidence.json' : 'evidence.json'),JSON.stringify(evidence,null,2));
  }
  await context.clearCookies();
  for (const width of [320,600,768,900,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto(origin);
    await page.locator('h1').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false, `Public home overflows at ${width}px`);
    await page.screenshot({path:resolve(output,`public-home-${width}.png`),fullPage:false});
  }
  await page.setViewportSize({width:320,height:640});
  await page.goto(origin);
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await page.getByRole('navigation',{name:'Mobile navigation'}).waitFor();
  await page.getByRole('dialog').getByRole('link',{name:'Investigate website'}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByLabel('Investigation goal',{exact:true}).selectOption('journey');
  await page.getByRole('button',{name:'Investigate my website',exact:true}).click();
  assert.ok(await page.locator('#start-error').innerText());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:resolve(output,'form-error-320.png'),fullPage:true});
  await context.addCookies([{name:'dropseo-session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(origin+`/investigations/${completed.id}`);
  await page.getByRole('button',{name:'Open profile menu'}).click();
  await page.getByRole('complementary',{name:'User profile menu'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('Escape');
  await page.getByLabel(`Open evidence for ${finding.title}`,{exact:true}).click();
  await page.locator('details[open]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:640,height:360});
  await page.getByRole('button',{name:'Open profile menu'}).click();
  const menu = page.getByRole('complementary',{name:'User profile menu'});
  assert.ok((await menu.boundingBox()).height<=264);
  evidence.scenarios.push('Mobile navigation closes on CTA; conditional goal input and validation; profile menu; expanded finding evidence; landscape menu scrolling.');
  await writeFile(resolve(output,process.env.RESPONSIVE_INTERACTIONS_ONLY ? 'interaction-evidence.json' : 'evidence.json'),JSON.stringify(evidence,null,2));
  assert.equal(evidence.issues.length,0,'Responsive matrix found horizontal overflow');
  console.log(JSON.stringify({checks:evidence.checks.length,issues:evidence.issues,scenarios:evidence.scenarios},null,2));
} finally { await browser.close(); }
