// Regenerate the public example using the same PDF layout as real reports.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const root = new URL("../", import.meta.url);
const source = (await readFile(new URL("lib/report-pdf.ts", root), "utf8"))
  .replace('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
const compiled = transpileModule(source, {
  compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
}).outputText;
const { exportInvestigationPdf } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const previousFetch = globalThis.fetch;
globalThis.fetch = async (url) => new Response(await readFile(new URL(`public${url}`, root)));
try {
  const doc = await exportInvestigationPdf({
    targetUrl: "https://example.com/pricing (illustrative URL)",
    profile: null,
    download: false,
    result: {
      runId: "sample-report",
      workflow: "Illustrative document review",
      goal: "Help a visitor understand available plans. Example scope: one pricing page document. Interactive checkout was not tested.",
      outcome: "ILLUSTRATIVE DATA: This report is a constructed example, not a real investigation of example.com. All observations, priorities and evidence are examples. No live timing or performance measurements were collected; zero counts and duration below are placeholders for this sample.",
      visitedPages: ["https://example.com/pricing (constructed example; not visited)"],
      actions: [],
      performance: { ttfb: 0, resources: 0, vitals: { lcp: 0, cls: 0, longTasks: 0 } },
      durationMs: 0,
      safety: { blockedActions: 0 },
      findings: [{
        title: "Main heading structure is unclear",
        category: "Accessibility",
        severity: "medium",
        expected: "The pricing page has one descriptive main heading so visitors can identify its purpose.",
        observed: "The example document contains two H1 headings: 'Our plans' and 'Get started'.",
        recommendation: "Keep 'Our plans' as the page H1. Use an H2 for 'Get started', then recheck the document heading outline.",
        confidence: "verified",
        affectedUrls: ["https://example.com/pricing"],
        evidence: [{
          url: "https://example.com/pricing",
          detail: "Illustrative HTML evidence: <h1>Our plans</h1> ... <h1>Get started</h1>. H1 count: 2. This constructed example was not collected from example.com.",
        }],
        verificationSupported: false,
      }],
    },
  });
  doc.setProperties({ title: "AudiFox - Sample investigation report", subject: "Illustrative data; not a real investigation" });
  await mkdir(new URL("public/reports/", root), { recursive: true });
  await writeFile(new URL("public/reports/audifox-sample-report.pdf", root), Buffer.from(doc.output("arraybuffer")));
  console.log(`Sample report generated (${doc.getNumberOfPages()} pages).`);
} finally {
  globalThis.fetch = previousFetch;
}
