type PdfFinding = {
  category: string;
  severity: string;
  title: string;
  expected: string;
  observed: string;
  recommendation: string;
  confidence: string;
};

type PdfReport = {
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
    .replace(/[^\x20-\x7E\n]/g, "");
}

export async function exportInvestigationPdf({ result, profile, targetUrl }: ExportPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    precision: 2,
  });

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
    const lines = doc.splitTextToSize(pdfSafe(value), width) as string[];
    doc.setFont("helvetica", options.style ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? colors.ink));
    doc.text(lines, x, y, { lineHeightFactor: leading / size });
    y += lines.length * leading;
    return lines.length * leading;
  };

  const sectionTitle = (title: string) => {
    ensureSpace(34);
    y += 10;
    doc.setFillColor(...colors.green);
    doc.roundedRect(margin, y - 3, 4, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
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

  doc.setFillColor(...colors.greenSoft);
  doc.roundedRect(margin, y, contentWidth, 116, 14, 14, "F");
  doc.setTextColor(...colors.green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AUDIFOX - EVIDENCE REPORT", margin + 20, y + 25);
  doc.setTextColor(...colors.ink);
  doc.setFontSize(21);
  doc.text("Website investigation", margin + 20, y + 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);
  const site = pdfSafe(targetUrl || result.visitedPages[0] || "Unknown website");
  doc.text(doc.splitTextToSize(site, contentWidth - 40), margin + 20, y + 73);
  doc.text(`Run ${pdfSafe(result.runId)}  |  ${pdfSafe(result.workflow)}  |  ${pdfSafe(new Date().toLocaleString())}`, margin + 20, y + 99);
  y += 136;

  sectionTitle("Executive summary");
  writeText(result.outcome || "Investigation completed.", margin, contentWidth, { size: 11, leading: 17 });
  if (result.goal) {
    y += 7;
    doc.setFont("helvetica", "bold");
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(pdfSafe(label).toUpperCase(), x + 11, y + 19);
    doc.setFont("helvetica", "bold");
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

  sectionTitle(`Verified findings (${result.findings.length})`);
  if (!result.findings.length) {
    doc.setFillColor(...colors.greenSoft);
    doc.roundedRect(margin, y, contentWidth, 44, 8, 8, "F");
    y += 17;
    writeText("No material issues were verified in this bounded run.", margin + 14, contentWidth - 28, { size: 10, color: colors.green, style: "bold" });
    y += 13;
  }

  result.findings.forEach((finding, index) => {
    const titleLines = doc.splitTextToSize(pdfSafe(`${index + 1}. ${finding.title}`), contentWidth - 30) as string[];
    const observedLines = doc.splitTextToSize(pdfSafe(finding.observed), contentWidth - 30) as string[];
    const recommendationLines = doc.splitTextToSize(pdfSafe(finding.recommendation), contentWidth - 30) as string[];
    const cardHeight = Math.max(104, 52 + titleLines.length * 14 + observedLines.length * 12 + recommendationLines.length * 12);
    ensureSpace(Math.min(cardHeight, contentBottom - margin));
    const cardTop = y;
    doc.setFillColor(250, 252, 251);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(margin, cardTop, contentWidth, cardHeight, 9, 9, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const severityColor = finding.severity.toLowerCase() === "high" ? colors.warning : colors.green;
    doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
    doc.text(`${pdfSafe(finding.severity).toUpperCase()}  |  ${pdfSafe(finding.category).toUpperCase()}`, margin + 15, cardTop + 18);
    y = cardTop + 37;
    writeText(`${index + 1}. ${finding.title}`, margin + 15, contentWidth - 30, { size: 11, leading: 14, style: "bold" });
    y += 4;
    writeText(`Observed: ${finding.observed}`, margin + 15, contentWidth - 30, { size: 8.5, leading: 12, color: colors.muted });
    y += 3;
    writeText(`Recommended: ${finding.recommendation}`, margin + 15, contentWidth - 30, { size: 8.5, leading: 12, color: colors.ink });
    y = cardTop + cardHeight + (index === result.findings.length - 1 ? 0 : 10);
  });

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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(`AudiFox - Evidence before claims - ${result.safety.blockedActions} actions blocked`, margin, pageHeight - 24);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  const filename = `audifox-report-${pdfSafe(result.runId).slice(0, 8) || "investigation"}.pdf`;
  doc.save(filename);
}
