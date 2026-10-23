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
  kind?: "report" | "solutions";
};

// Playbooks describe proposed work, never claim access to the site's source code.
export function solutionSteps(finding: PdfFinding): string[] {
  if (finding.severity === "resolved") return ["Keep the passing implementation and save the successful replay as a regression check. Repeat it after changes to the affected page or shared components."];
  const subject = `${finding.title} ${finding.observed}`.toLowerCase();
  const playbooks: Array<[RegExp, string[]]> = [
    [/viewport/, ["Add a viewport meta tag with width=device-width, initial-scale=1 to the document head. Ensure the page template does not emit duplicate or conflicting viewport settings; preserve the user's ability to zoom.", "Test narrow and wide viewports for horizontal overflow, clipped controls and unreadable text. Adjust fixed widths and responsive breakpoints where needed, then verify keyboard focus and touch interactions."]],
    [/secure connection|https/, ["Configure a valid TLS certificate for the affected hostname at the hosting provider or reverse proxy. Verify that the HTTPS version serves the intended page before enabling redirects.", "Redirect HTTP requests to the corresponding HTTPS URL and update internal links, canonical URLs and asset references. Check for mixed-content failures and test the certificate and redirect behavior on every affected hostname."]],
    [/social sharing|open graph/, ["Add page-specific og:title and og:description metadata to the rendered document head. Keep these values consistent with the visible page content and use an absolute URL for any preview image.", "Inspect the served HTML to ensure preview crawlers can read the metadata without requiring interaction. Validate the shared link preview and refresh any platform cache after publishing the change."]],
    [/meta description/, ["Edit the affected route's metadata or CMS SEO fields. Write a page-specific description that accurately summarizes the content and primary action; follow the recorded recommendation for length.", "Ensure the rendered head contains one non-empty meta description. Check route overrides and shared templates so a default does not erase the page-specific value."]],
    [/page title|title tag|document title/, ["Set a unique, descriptive title in the affected page's metadata or CMS. Put the page purpose first and add the brand only where useful; follow the recorded recommendation for length.", "Inspect the rendered head after navigation and a direct reload. Confirm there is one title and that other routes do not inherit the same generic value."]],
    [/canonical/, ["Choose the intended primary URL for this content, accounting for tracking parameters, duplicate routes and redirects. Add one absolute canonical link in the page head.", "Confirm the canonical destination loads successfully and represents equivalent content. Keep internal links, redirects and sitemap entries consistent with that destination."]],
    [/noindex|excluded from search|indexing/, ["Confirm with the site owner that the affected page should be public in search results. Retain exclusion for private, staging or intentionally hidden pages.", "For a page intended for indexing, remove unintended noindex directives from both HTML metadata and X-Robots-Tag response headers. Inspect CMS settings and hosting rules that may reintroduce them; then recheck the served response."]],
    [/heading|\bh1\b/, ["Review the page outline. Give the primary content a descriptive main heading and organize subsections with semantic heading levels instead of choosing levels for visual size.", "Update the page or shared component that creates missing or duplicate main headings. Preserve its appearance with CSS and verify the resulting outline with assistive technology."]],
    [/language|lang attribute/, ["Set the root html lang attribute to the language actually used by this page, for example en for English. Use the route's locale for translated pages.", "Mark passages in other languages with their own lang attribute. Inspect the rendered DOM and check pronunciation with a screen reader after both direct loading and client navigation."]],
    [/alt attribute|alt text/, ["Inspect each affected image in context. Give informative images concise alternative text describing their purpose; use an empty alt attribute for purely decorative images.", "For linked images, describe the destination or action when no other accessible name exists. Update reusable image components so alt text is deliberately supplied, then inspect the accessibility tree."]],
    [/label|accessible name|unnamed control/, ["Identify each affected input, button or link in the accessibility tree. Associate visible form labels using matching for and id values; give icon-only controls a concise accessible name.", "Prefer native controls and visible text. Use aria-label or aria-labelledby only where needed, avoid placeholder-only labels, and confirm every control's name describes its actual action using keyboard and screen-reader navigation."]],
    [/largest content|\blcp\b/, ["Record a performance trace for the affected URL and identify its actual LCP element and request chain. Determine whether delay comes from server response, resource discovery, transfer or rendering.", "If the element is an image, serve an appropriately sized compressed variant and avoid lazy-loading that above-the-fold asset. Prioritize only the critical request; reduce render-blocking styles or scripts if the trace identifies those as the bottleneck."]],
    [/layout shift|\bcls\b/, ["Record the journey with layout-shift highlighting and locate the elements that move. Include late-loading images, fonts, embeds and asynchronous content in the review.", "Reserve dimensions or aspect ratios before assets load, allocate stable space for dynamic content, and avoid inserting banners above visible content. Repeat the journey at mobile and desktop widths to check that the measured shifts are reduced."]],
    [/server response|\bttfb\b/, ["Measure the affected route from a representative location and inspect server traces to separate backend processing from network latency. Identify slow database calls, upstream services and cache misses.", "Optimize the measured bottleneck and cache public responses where appropriate. Keep personalized data out of shared caches and validate invalidation behavior before comparing fresh and cached requests."]],
    [/oversized|responsive image/, ["Compare the image's rendered dimensions with its downloaded dimensions at relevant viewport sizes and pixel densities. Generate compressed variants appropriate for those sizes.", "Supply srcset and sizes, preserve width and height or aspect ratio, and lazy-load only offscreen images. Verify the browser selects the expected resource without reducing visible image quality."]],
    [/script count|long task|javascript/, ["Use a performance trace and coverage report to identify costly scripts and long tasks on the affected journey. Separate essential functionality from unused or third-party code.", "Remove unused dependencies, split code by route and load optional scripts after they are needed. Break expensive main-thread work into smaller tasks, then verify that interaction and initialization order still work."]],
    [/transfer size|heavy|payload/, ["Sort the affected page's network requests by transferred bytes. Identify large images, fonts, scripts and duplicate downloads before selecting assets to change.", "Compress or resize the largest assets, remove unused resources and defer non-critical downloads. Configure compression and caching where applicable, then compare cold-load transfer totals and verify visual quality."]],
    [/network|request.*fail|broken link|http.*error/, ["Reproduce the exact failed URL and inspect its status, response and request initiator. Distinguish an application defect from authentication, temporary service failure or a restriction of the investigation environment.", "Correct the confirmed cause in the route, asset reference, upstream service or request configuration. Add a useful error state and retry only where safe; rerun the original action and confirm the expected response and content."]],
    [/console|client error/, ["Reproduce the recorded error with developer tools open and capture the stack trace and triggering action. Use source maps to locate the responsible application or third-party code.", "Correct the underlying exception or invalid assumption and provide a recoverable error state where needed. Repeat the journey and inspect both console output and the resulting UI to ensure the error is resolved."]],
    [/interaction|workflow|replay|journey/, ["Replay the recorded steps and locate the first point where actual behavior differs from the expected journey. Inspect the control, event handler, navigation target and any associated request.", "Correct the confirmed failure and provide immediate loading, success or error feedback for asynchronous actions. Check keyboard activation, prevent duplicate submissions where appropriate, and replay the full journey from a clean session."]],
  ];
  const steps = playbooks.find(([pattern]) => pattern.test(subject))?.[1];
  return steps || [
    `Reproduce the reported behavior on the affected URLs and compare it with this acceptance criterion: ${finding.expected || "the intended page behavior, confirmed with the site owner"}. Inspect the responsible page, component or configuration and record the confirmed cause before changing it.`,
    `Apply the recorded recommendation: ${finding.recommendation || "identify and correct the confirmed cause"}. Make the smallest change that restores the expected behavior, accounting for loading, empty and error states where relevant. The investigation does not identify an exact source file, so confirm the implementation location in the site's codebase.`,
    "Check other pages that share the changed component or configuration. Add a regression check for the reproduced failure and compare the same journey before and after the change.",
  ];
}

export function exportSolutionsPdf(input: ExportPdfInput) {
  return exportInvestigationPdf({ ...input, kind: "solutions" });
}

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

export async function exportInvestigationPdf({ result, profile, targetUrl, investigationId, createdAt, download = true, kind = "report" }: ExportPdfInput) {
  const solutions = kind === "solutions";
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
    title: `AudiFox ${solutions ? "solutions" : "investigation"} ${result.runId}`,
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
  doc.text(solutions ? "AUDIFOX - SOLUTIONS REPORT" : "AUDIFOX - EVIDENCE REPORT", margin + 20, y + 25);
  doc.setTextColor(...colors.ink); doc.setFontSize(21);
  doc.text(solutions ? "Investigation solutions" : "Website investigation", margin + 20, y + 52);
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

  if (solutions) {
    sectionTitle("How to use this plan");
    writeText("Each finding below has a corresponding proposed solution. Start with the highest-severity confirmed issues. Reproduce unverified theories before changing the site. These steps are based on saved evidence and recommendations; they are not source-code diagnoses or proof that a fix has been applied.", margin, contentWidth);
  }
  sectionTitle(`${solutions ? "Solutions" : "Findings"} (${result.findings.length})`);
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
    if (solutions) {
      y += 8;
      writeText(finding.severity === "resolved" ? "Maintain the verified behavior" : "Implementation plan", margin, contentWidth, { size: 11, style: "bold" });
      if (finding.confidence === "hypothesis") writeText("Confirm first: this finding is an unverified theory. Reproduce the observed behavior and capture evidence before applying the proposed changes.", margin, contentWidth, { size: 9, color: colors.warning });
      solutionSteps(finding).forEach((step, stepIndex) => writeText(`${stepIndex + 1}. ${step}`, margin, contentWidth, { size: 9, leading: 14 }));
      y += 6;
      writeText("Validate the result", margin, contentWidth, { size: 11, style: "bold" });
      writeText(`Repeat the original check on ${finding.affectedUrls?.join(", ") || "the affected page identified in the evidence; if none is recorded, establish the scope first"}. Expected result: ${finding.expected || "confirm the acceptance criterion with the site owner"}. Capture the new evidence and compare it with the observation above. For measured performance issues, repeat under comparable device, network and cache conditions.`, margin, contentWidth, { size: 9, leading: 14 });
      writeText(finding.verificationSupported ? "Use Verify fix to run the matching check as a separate investigation. Review its dated comparison before marking the issue resolved." : "A matching automated verification is unavailable. Perform a targeted manual check and retain the result; do not treat the proposed solution as a verified fix.", margin, contentWidth, { size: 9, leading: 14 });
      writeText("Release and follow-up: validate in a preview or staging environment, check shared pages for regressions, then monitor after release. Revert the change if it breaks the primary journey.", margin, contentWidth, { size: 9, leading: 14 });
      y += 6;
    }
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

  const filename = `audifox-${solutions ? "solutions" : "report"}-${pdfSafe(result.runId).slice(0, 8) || "investigation"}.pdf`;
  if (download) doc.save(filename);
  return doc;
}
