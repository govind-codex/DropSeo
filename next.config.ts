import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Keep the CLI package external while the integrated route bundles the
     Playwright worker; Webcmd runs as a subprocess only where supported. */
  serverExternalPackages: ["@agentrhq/webcmd"],
};

export default nextConfig;
