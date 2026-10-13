type PdfFinding = {
  category: string;
  severity: string;
  title: string;
  expected: string;
  observed: string;
  recommendation: string;
  confidence: string;
  affectedUrls?: string[];
  evidence?: Array<{ url: string; detail: string; capturedAt?: string; image?: string }>;
  verificationSupported?: boolean;
};

type PdfReport = {
  completedAt?: string;
  verifiedAt?: string;
  comparison?: { referenceId: string; issues: Array<{ finding: { title: string }; status: string; detail: string }> };
  runId: string;
  workflow: string;
  goal: string;
  outcome: string;
  visitedPages: string[];
  actions: Array<Record<string, unknown>>;
  performance: {
    ttfb: number;
    resources: number;
    vitals: { lcp: number; cls: number; longTasks: number };
  };
  findings: PdfFinding[];
  safety: { blockedActions: number };
  durationMs: number;
};

type PdfProfile = {
  siteType: string;
  purpose: string;
  primaryJourney: string;
  plan: string[];
} | null;

type ExportPdfInput = {
  result: PdfReport;
  profile: PdfProfile;
  targetUrl: string;
  investigationId?: string;
  createdAt?: string;
  download?: boolean;
};

const colors = {
  ink: [16, 42, 45] as const,
  muted: [94, 116, 112] as const,
  green: [8, 124, 104] as const,
  greenSoft: [237, 248, 244] as const,
  line: [220, 231, 228] as const,
  paper: [255, 255, 255] as const,
  warning: [181, 68, 62] as const,
};

function pdfSafe(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

export async function exportInvestigationPdf({ result, profile, targetUrl, investigationId, createdAt, download = true }: ExportPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    precision: 2,
  });

  for (const style of ["normal", "bold"] as const) {
    const filename = style === "bold" ? "NotoSans-Bold.ttf" : "NotoSans-Regular.ttf";
    const response = await fetch(`/fonts/${filename}`);
    if (!response.ok) throw new Error("Report font could not be loaded. Reconnect and retry.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    doc.addFileToVFS(filename, btoa(binary));
    doc.addFont(filename, "NotoSans", style);
  }
  doc.setFont("NotoSans", "normal");
  const font = doc.getFont() as unknown as { metadata: { characterToGlyph(code: number): number } };
  const content = pdfSafe(JSON.stringify({ result, profile, targetUrl }));
  if ([...content].some((character) => character.codePointAt(0)! > 32 && !font.metadata.characterToGlyph(character.codePointAt(0)!))) throw new Error("This report contains characters the PDF font cannot display. Use your browser's Print to PDF to preserve them.");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - 42;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const ensureSpace = (height: number) => {
    if (y + height > contentBottom) addPage();
  };

  const writeText = (
    value: unknown,
    x: number,
    width: number,
    options: { size?: number; leading?: number; color?: readonly [number, number, number]; style?: "normal" | "bold" } = {},
  ) => {
    const size = options.size ?? 10;
    const leading = options.leading ?? size * 1.45;
    doc.setFont("NotoSans", options.style ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? colors.ink));
    const lines = doc.splitTextToSize(pdfSafe(value), width) as string[];
    for (const line of lines) {
      ensureSpace(leading + 4);
      doc.text(line, x, y);
      y += leading;
    }
    return lines.length * leading;
  };

  const sectionTitle = (title: string) => {
    ensureSpace(34);
    y += 10;
    doc.setFillColor(...colors.green);
    doc.roundedRect(margin, y - 3, 4, 18, 2, 2, "F");
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...colors.ink);
    doc.text(pdfSafe(title), margin + 13, y + 10);
    y += 28;
  };

  doc.setProperties({
    title: `AudiFox investigation ${result.runId}`,
    subject: pdfSafe(result.outcome),
    author: "AudiFox",
    creator: "AudiFox Agent",
  });

  const site = pdfSafe(targetUrl || result.visitedPages[0] || "Unknown website");
  doc.setFont("NotoSans", "normal"); doc.setFontSize(9);
  const siteLines = doc.splitTextToSize(site, contentWidth - 40) as string[];
  const headerHeight = Math.max(116, 95 + siteLines.length * 13);
  doc.setFillColor(...colors.greenSoft);
  doc.roundedRect(margin, y, contentWidth, headerHeight, 14, 14, "F");
  doc.setTextColor(...colors.green); doc.setFont("NotoSans", "bold"); doc.setFontSize(11);
  doc.text("AUDIFOX - EVIDENCE REPORT", margin + 20, y + 25);
  doc.setTextColor(...colors.ink); doc.setFontSize(21);
  doc.text("Website investigation", margin + 20, y + 52);
  doc.setFont("NotoSans", "normal"); doc.setFontSize(9); doc.setTextColor(...colors.muted);
  doc.text(siteLines, margin + 20, y + 73, { lineHeightFactor: 13 / 9 });
  const runLabel = `Run ${pdfSafe(result.runId)} | ${pdfSafe(result.workflow)} | ${pdfSafe(result.completedAt || createdAt || "Date not recorded")}`;
  doc.text(doc.splitTextToSize(runLabel, contentWidth - 40), margin + 20, y + headerHeight - 18);
  y += headerHeight + 20;

  if (investigationId) writeText(`Investigation ID: ${investigationId}`, margin, contentWidth, { size: 9 });
  writeText(`Exported: ${new Date().toISOString()}`, margin, contentWidth, { size: 9 });
  sectionTitle("Executive summary");
  writeText(result.outcome || "Investigation completed.", margin, contentWidth, { size: 11, leading: 17 });
  if (result.goal) {
    y += 7;
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.green);
    doc.text("GOAL", margin, y);
    y += 13;
    writeText(result.goal, margin, contentWidth, { size: 9.5, leading: 14, color: colors.muted });
  }

  ensureSpace(88);
  y += 14;
  const metrics = [
    ["Pages", result.visitedPages.length],
    ["Findings", result.findings.length],
    ["LCP", result.performance.vitals.lcp ? `${(result.performance.vitals.lcp / 1000).toFixed(2)}s` : "N/A"],
    ["Duration", `${(result.durationMs / 1000).toFixed(1)}s`],
  ];
  const metricGap = 8;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (metricWidth + metricGap);
    doc.setFillColor(248, 251, 250);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(x, y, metricWidth, 62, 8, 8, "FD");
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(pdfSafe(label).toUpperCase(), x + 11, y + 19);
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...colors.ink);
    doc.text(pdfSafe(value), x + 11, y + 43);
  });
  y += 76;

  if (profile) {
    sectionTitle("Site profile");
    writeText(`${profile.siteType} - ${profile.primaryJourney}`, margin, contentWidth, { size: 11, leading: 16, style: "bold" });
    y += 3;
    writeText(profile.purpose, margin, contentWidth, { size: 9.5, leading: 14, color: colors.muted });
  }

  sectionTitle(`Findings (${result.findings.length})`);
  if (!result.findings.length) {
    doc.setFillColor(...colors.greenSoft);
    doc.roundedRect(margin, y, contentWidth, 44, 8, 8, "F");
    y += 17;
    writeText("No material issues were verified in this bounded run.", margin + 14, contentWidth - 28, { size: 10, color: colors.green, style: "bold" });
    y += 13;
  }

  result.findings.forEach((finding, index) => {
    ensureSpace(80);
    y += 12;
    writeText(`${finding.severity.toUpperCase()} | ${finding.category} | ${finding.confidence === "hypothesis" ? "UNVERIFIED THEORY" : "OBSERVED CHECK; FIX NOT VERIFIED"}`, margin, contentWidth, { size: 9, leading: 14, color: colors.green, style: "bold" });
    writeText(`${index + 1}. ${finding.title}`, margin, contentWidth, { size: 12, leading: 17, style: "bold" });
    writeText(`Affected URLs: ${finding.affectedUrls?.join(", ") || "Not recorded"}`, margin, contentWidth, { size: 9, leading: 14 });
    writeText(`Expected: ${finding.expected}`, margin, contentWidth, { size: 9, leading: 14 });
    writeText(`Observed: ${finding.observed}`, margin, contentWidth, { size: 9, leading: 14 });
    writeText(`Recommended next action: ${finding.recommendation}`, margin, contentWidth, { size: 9, leading: 14 });
    writeText(`Verification: ${finding.verificationSupported ? "Matching check can be rerun as a separate investigation" : "Targeted verification unavailable"}`, margin, contentWidth, { size: 9, leading: 14 });
    if (finding.evidence?.length) for (const evidence of finding.evidence) {
      writeText(`Evidence${evidence.capturedAt ? ` (${evidence.capturedAt})` : ""}: ${evidence.url} - ${evidence.detail}`, margin, contentWidth, { size: 9, leading: 14, color: colors.muted });
      if (evidence.image) {
        const image = doc.getImageProperties(evidence.image);
        const scale = Math.min(contentWidth / image.width, 180 / image.height);
        const height = image.height * scale;
        ensureSpace(height + 28);
        writeText("Saved screenshot context for the affected page", margin, contentWidth, { size: 8, leading: 12 });
        doc.addImage(evidence.image, image.fileType, margin, y, image.width * scale, height);
        y += height + 12;
      }
    }
    else writeText("Supporting artifact not recorded. Reproduce before relying on this finding.", margin, contentWidth, { size: 9, leading: 14 });
  });
  if (result.comparison) {
    sectionTitle("Verification comparison");
    writeText(`Original investigation: ${result.comparison.referenceId}. Verification date: ${result.verifiedAt || result.completedAt || createdAt || "Not recorded"}`, margin, contentWidth, { size: 9, leading: 14 });
    for (const issue of result.comparison.issues) writeText(`${issue.status}: ${issue.finding.title} - ${issue.detail}`, margin, contentWidth, { size: 9, leading: 14 });
  }

  const pagesPreviewHeight = 38 + Math.min(result.visitedPages.length, 6) * 15;
  ensureSpace(pagesPreviewHeight);
  sectionTitle(`Pages reviewed (${result.visitedPages.length})`);
  result.visitedPages.forEach((page, index) => {
    ensureSpace(22);
    writeText(`${index + 1}. ${page}`, margin, contentWidth, { size: 8.5, leading: 13, color: colors.muted });
    y += 2;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(`AudiFox - Evidence before claims - ${result.safety.blockedActions} actions blocked`, margin, pageHeight - 24);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  const filename = `audifox-report-${pdfSafe(result.runId).slice(0, 8) || "investigation"}.pdf`;
  if (download) doc.save(filename);
  return doc;
}
