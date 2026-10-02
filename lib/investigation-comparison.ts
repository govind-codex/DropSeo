import type { Investigation } from "./investigations";
type Finding = { id: string; title: string; category: string; severity: string; confidence?: string; workflowId?: string };
type CheckPage = { url: string; checks: { name: string; pass: boolean }[] };
export type Comparison = { referenceId: string; issues: { finding: Finding; status: "Fixed" | "Still present" | "Newly detected" | "Unverified"; detail: string }[] };
const key = (finding: Finding) => `${finding.category}:${finding.title}`.trim().toLowerCase();
export function compareInvestigations(original: Investigation, current: Record<string, unknown>): Comparison {
  const baseline = (original.result?.findings || []) as Finding[];
  const fresh = (current.findings || []) as Finding[];
  const previousPages = (original.result?.checkEvidence || []) as CheckPage[];
  const currentPages = (current.checkEvidence || []) as CheckPage[];
  const issues: Comparison["issues"] = baseline.filter((finding) => finding.severity !== "resolved").map((finding) => {
    if (fresh.some((item) => key(item) === key(finding) && item.severity !== "resolved")) return { finding, status: "Still present", detail: "Detected again in the current investigation." };
    const affected = previousPages.filter((page) => page.checks.some((check) => check.name === finding.title && !check.pass));
    const checked = affected.length > 0 && affected.every((page) => currentPages.some((freshPage) => freshPage.url === page.url && freshPage.checks.some((check) => check.name === finding.title && check.pass)));
    const browserChecks = (current.checkEvidence || []) as CheckPage[];
    const originalPages = original.result?.visitedPages as string[] | undefined;
    const browserPassed = finding.confidence === "verified" && originalPages?.length === 1 && browserChecks.some((page) => page.url === originalPages[0] && page.checks.some((check) => check.name === finding.title && check.pass));
    return { finding, status: checked || browserPassed ? "Fixed" : "Unverified", detail: checked || browserPassed ? "The original check passed on every affected page." : "The original issue was not reproduced, but matching passing evidence is incomplete." };
  });
  fresh.filter((finding) => finding.severity !== "resolved" && finding.category !== "Verification" && !baseline.some((item) => key(item) === key(finding))).forEach((finding) => issues.push({ finding, status: "Newly detected", detail: "Detected in this verification; absent from the original report." }));
  return { referenceId: original.id, issues };
}
