const GOAL_STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "complete",
  "find",
  "from",
  "into",
  "open",
  "page",
  "should",
  "signing",
  "site",
  "that",
  "their",
  "there",
  "this",
  "visitor",
  "website",
  "without",
]);

function goalTerms(goal) {
  return [...new Set(String(goal || "").toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3 && !GOAL_STOP_WORDS.has(term)))];
}

export function assessGoalCompletion({ goal, observation, history, plannerSatisfied = false }) {
  const terms = goalTerms(goal);
  const changedAction = history.some((item) => item.ok && item.changed);
  const haystack = `${observation?.url || ""} ${observation?.title || ""} ${observation?.text || ""}`.toLowerCase();
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  const requiredMatches = terms.length <= 1 ? terms.length : Math.max(2, Math.ceil(terms.length * 0.6));
  const evidenceMatched = Boolean(terms.length && changedAction && matchedTerms.length >= requiredMatches);
  return {
    passed: Boolean(plannerSatisfied || evidenceMatched),
    plannerSatisfied: Boolean(plannerSatisfied),
    changedAction,
    matchedTerms,
    requiredMatches,
    finalUrl: observation?.url || "",
    finalTitle: observation?.title || "",
  };
}

export function assessVerification({ baselineWorkflow, replayResult }) {
  if (!baselineWorkflow) {
    return { passed: false, baselineAvailable: false, replayed: false, message: "No previous browser workflow was available to replay." };
  }
  if (!replayResult) {
    return { passed: false, baselineAvailable: true, replayed: false, message: "The previous browser workflow could not be replayed in this run." };
  }
  if (!replayResult.passed) {
    return { passed: false, baselineAvailable: true, replayed: true, message: replayResult.message || "The previous browser workflow failed during replay." };
  }
  return { passed: true, baselineAvailable: true, replayed: true, message: replayResult.message || "The previous browser workflow completed successfully." };
}
