export function webcmdRuntimeEnabled() {
  if (process.env.WEBCMD_ENABLED === "false") return false;

  // Railway's small containers cannot reliably run Playwright and Webcmd's
  // additional managed browser together. Require an explicit opt-in there.
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  return !onRailway || process.env.WEBCMD_ENABLE_RAILWAY === "true";
}
