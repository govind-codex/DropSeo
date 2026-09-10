import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/agent/run": ["./agent/worker.mjs", "./node_modules/@sparticuz/chromium-min/**/*", "./node_modules/playwright-core/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/agent/run": ["./outputs/**/*", "./dist/**/*", "./.wrangler/**/*", "./.sites-runtime/**/*"],
  },
};

export default nextConfig;
