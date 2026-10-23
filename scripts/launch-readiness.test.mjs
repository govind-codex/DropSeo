import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8").replace('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
  const js = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const intent = await load("../lib/investigation-intent.ts");
const presentation = await load("../lib/finding-presentation.ts");

test("HTTP(S) intent validation and handoff reject unsafe or incomplete input", () => {
  assert.equal(intent.validateWebsiteUrl(" https://example.com/pricing#plan "), "https://example.com/pricing");
  assert.equal(intent.validateWebsiteUrl("http://example.com/"), "http://example.com/");
  for (const value of ["", "example.com", "ftp://example.com/", "javascript:alert(1)", "https://user:pass@example.com/", "https://localhost/", "https://example.com:8000/"]) assert.throws(() => intent.validateWebsiteUrl(value));
  assert.equal(intent.readInvestigationIntent(new URLSearchParams({ url: "https://example.com", workflow: "journey" })), null);
  assert.equal(intent.readInvestigationIntent(new URLSearchParams({ url: "https://example.com", workflow: "verify" })), null);
  const accepted = intent.readInvestigationIntent(new URLSearchParams({ url: "https://example.com", workflow: "journey", goal: "Find a plan" }));
  const destination = new URL(intent.intentDestination(accepted), "https://audifox.example");
  assert.equal(destination.pathname, "/dashboard");
  assert.equal(destination.searchParams.get("goal"), "Find a plan");
  assert.equal(destination.searchParams.get("continue"), "1");
});

test("finding presentation keeps evidence attached and orders severity consistently", () => {
  const findings = [
    { id: "ai", title: "Theory", category: "AI", severity: "high", confidence: "hypothesis" },
    { id: "title", title: "Title", category: "Technical", severity: "critical", confidence: "verified" },
    { id: "language", title: "Language", category: "Accessibility", severity: "medium", confidence: "verified" },
  ];
  const result = { findings, checkEvidence: [{ url: "https://example.com/title", checks: [{ name: "Title", pass: false, detail: "Title tag absent" }] }, { url: "https://example.com/language", checks: [{ name: "Language", pass: false, detail: "Language absent" }] }] };
  presentation.prepareReportFindings(result);
  assert.deepEqual(result.findings.map((finding) => finding.id), ["title", "ai", "language"]);
  assert.deepEqual(result.findings[0].evidence, [{ url: "https://example.com/title", detail: "Title tag absent" }]);
  assert.equal(result.findings[0].verificationSupported, true);
  assert.equal(result.findings[1].verificationSupported, false);
  assert.deepEqual(result.findings[2].affectedUrls, ["https://example.com/language"]);
  const verification = { ...result, comparison: { issues: [{ finding: findings[0], status: "Newly detected" }] } };
  presentation.prepareReportFindings(verification);
  assert.ok(verification.findings.every((finding) => !finding.verificationSupported));
  const screenshotReport = { findings: [{ ...findings[1], evidence: [{ url: "https://example.com/title", detail: "Measured title check", snapshotId: "matching" }] }], checkEvidence: result.checkEvidence };
  presentation.prepareReportFindings(screenshotReport, [{ type: "snapshot", id: "matching", url: "https://example.com/wrong", image: "data:image/jpeg;base64,test" }]);
  assert.equal(screenshotReport.findings[0].evidence[0].image, undefined);
  presentation.prepareReportFindings(screenshotReport, [{ type: "snapshot", id: "matching", url: "https://example.com/title", image: "data:image/jpeg;base64,test" }]);
  assert.equal(screenshotReport.findings[0].evidence[0].image, "data:image/jpeg;base64,test");
});

test("PDF represents expected behaviour, evidence, theories and dated verification across long pages", async () => {
  const pdf = await load("../lib/report-pdf.ts");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(readFileSync(new URL(`../public${url}`, import.meta.url)));
  try {
    const result = {
      runId: "pdf-fixture", workflow: "verify", completedAt: "2026-10-13T00:00:00Z", verifiedAt: "2026-10-13T00:01:00Z",
      goal: "Find pricing", outcome: "Fixture report for review", visitedPages: ["https://example.com/pricing"], actions: [],
      performance: { ttfb: 50, resources: 3, vitals: { lcp: 0, cls: 0, longTasks: 0 } }, safety: { blockedActions: 0 }, durationMs: 500,
      findings: [{ category: "Accessibility", severity: "high", title: "Résumé heading", confidence: "hypothesis", expected: "One descriptive H1", observed: "Two main headings. ".repeat(800), recommendation: "Keep one H1", affectedUrls: ["https://example.com/pricing"], evidence: [{ url: "https://example.com/pricing", detail: "H1 count: 2" }] }],
      comparison: { referenceId: "original-fixture", issues: [{ finding: { title: "Résumé heading" }, status: "Unverified", detail: "No matching passing evidence" }] },
    };
    for (const exporter of [pdf.exportInvestigationPdf, pdf.exportSolutionsPdf]) {
    const doc = await exporter({ result, profile: null, targetUrl: result.visitedPages[0], investigationId: "saved-fixture", download: false });
    assert.ok(doc.getNumberOfPages() >= 3);
    const raw = doc.output();
    assert.ok(raw.startsWith("%PDF"));
    // Inspect jsPDF's actual text placement rather than mirroring a height formula.
    const texts = [];
    const height = doc.internal.pageSize.getHeight();
    for (const page of doc.internal.pages.slice(1)) {
      let y = 0;
      for (const command of page) {
        const position = command.match(/^([\d.]+) ([\d.]+) Td$/m);
        if (position) y = Number(position[2]);
        if (/Tj/.test(command)) assert.ok(y >= 20 && y <= height - 25, `Text outside page content: ${y}`);
        texts.push(command);
      }
    }
    assert.ok(texts.length > 100);
    }
    assert.match(pdf.solutionSteps(result.findings[0]).join(" "), /page outline/);
    assert.match(pdf.solutionSteps({ ...result.findings[0], title: "Unknown defect", observed: "Custom issue" }).join(" "), /acceptance criterion/);
    assert.match(pdf.solutionSteps({ ...result.findings[0], severity: "resolved" }).join(" "), /passing implementation/);
    const empty = await pdf.exportSolutionsPdf({ result: { ...result, findings: [] }, profile: null, targetUrl: result.visitedPages[0], download: false });
    assert.ok(empty.output().startsWith("%PDF"));
    await assert.rejects(() => pdf.exportInvestigationPdf({ result: { ...result, outcome: "Unsupported emoji 🦊" }, profile: null, targetUrl: result.visitedPages[0], download: false }), /cannot display/);
  } finally { globalThis.fetch = previousFetch; }
});
