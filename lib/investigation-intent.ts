export type InvestigationIntent = { url: string; goal: string; workflow: "autonomous" | "journey" | "performance" };

export function validateWebsiteUrl(value: string): string {
  if (!value.trim()) throw new Error("Enter the website you want to investigate.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Include http:// or https://, for example https://example.com."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use an HTTP or HTTPS website address.");
  if (url.username || url.password) throw new Error("Remove the username and password from the address.");
  if (value.length > 2048 || url.port || !url.hostname.includes(".") || url.hostname.includes(":") || /^\d/.test(url.hostname) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error("Use a public website with a standard HTTP or HTTPS port.");
  url.hash = "";
  return url.href;
}

export function readInvestigationIntent(params: URLSearchParams): InvestigationIntent | null {
  try {
    const workflow = params.get("workflow") || "autonomous";
    if (!["autonomous", "journey", "performance"].includes(workflow)) return null;
    const goal = (params.get("goal") || "").trim().slice(0, 500);
    if (workflow === "journey" && !goal) return null;
    return { url: validateWebsiteUrl(params.get("url") || ""), goal, workflow: workflow as InvestigationIntent["workflow"] };
  } catch { return null; }
}

export function intentDestination(intent: InvestigationIntent) {
  return `/dashboard?${new URLSearchParams({ ...intent, continue: "1" })}`;
}
