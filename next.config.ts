import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/agent/run": ["./node_modules/@sparticuz/chromium-min/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/agent/run": ["./outputs/**/*", "./dist/**/*", "./.wrangler/**/*", "./.sites-runtime/**/*"],
  },
};

export default nextConfig;
