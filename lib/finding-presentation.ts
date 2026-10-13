export type FindingEvidence = { url: string; detail: string; image?: string; snapshotId?: string; capturedAt?: string };
export type Finding = {
  id: string; category: string; severity: string; title: string; expected: string; observed: string;
  recommendation: string; confidence: string; evidenceType: string; workflowId?: string;
  affectedUrls?: string[]; evidence?: FindingEvidence[]; verificationSupported?: boolean;
};
const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, resolved: 5 };
export function sortFindings<T extends { severity: string; title: string }>(findings: T[]): T[] {
  return [...findings].sort((a, b) => (severityOrder[a.severity.toLowerCase()] ?? 4) - (severityOrder[b.severity.toLowerCase()] ?? 4) || a.title.localeCompare(b.title));
}

// Only matching deterministic checks support finding-level verification. A saved
// browser workflow alone does not prove it tests an arbitrary finding.
export function supportsVerification(finding: { title: string; confidence?: string }, result: Record<string, unknown>) {
  const pages = (result.checkEvidence || []) as Array<{ url: string; checks: Array<{ name: string; pass: boolean }> }>;
  return finding.confidence === "verified" && pages.some((page) => page.checks.some((check) => check.name === finding.title && !check.pass));
}

export function prepareReportFindings(result: Record<string, unknown>, events: Record<string, unknown>[] = []) {
  const pages = (result.checkEvidence || []) as Array<{ url: string; checks: Array<{ name: string; pass: boolean; detail?: string }> }>;
  const comparison = result.comparison as { issues: Array<{ finding: { title: string; category: string }; status: string }> } | undefined;
  result.findings = sortFindings(((result.findings || []) as Finding[]).map((finding) => {
    const matching = pages.filter((page) => page.checks.some((check) => check.name === finding.title && !check.pass));
    const evidence = finding.evidence || matching.map((page) => ({ url: page.url, detail: page.checks.find((check) => check.name === finding.title)?.detail || finding.observed }));
    return { ...finding,
      affectedUrls: finding.affectedUrls || matching.map((page) => page.url),
      evidence: evidence.map((item: FindingEvidence) => {
        const snapshot = item.snapshotId && events.find((event) => event.type === "snapshot" && event.id === item.snapshotId && event.url === item.url && /^data:image\/(jpeg|png|webp);base64,/.test(String(event.image)));
        return snapshot ? { ...item, image: String(snapshot.image) } : item;
      }),
      verificationSupported: supportsVerification(finding, result) && (!comparison || comparison.issues.some((issue) => issue.status !== "Newly detected" && issue.finding.title === finding.title && issue.finding.category === finding.category)),
    };
  }));
  return result;
}
