import type { NextConfig } from "next";
import { resolve } from "node:path";
const nextConfig: NextConfig = {
  turbopack: { resolveAlias: { "@/lib/investigation-runtime": "./lib/investigation-runtime.node.ts" } },
  webpack(config) {
    config.resolve.alias["@/lib/investigation-runtime"] = resolve("lib/investigation-runtime.node.ts");
    return config;
  },
};
export default nextConfig;
