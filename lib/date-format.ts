// A deterministic server/client format avoids hydration differences across locales.
export function formatInvestigationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
