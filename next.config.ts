import type { NextConfig } from "next";
import { resolve } from "node:path";
const nextConfig: NextConfig = {
  distDir: process.env.AUDIFOX_BUILD_DIR || ".next",
  turbopack: { resolveAlias: { "@/lib/investigation-runtime": "./lib/investigation-runtime.node.ts" } },
  webpack(config, { webpack }) {
    config.resolve.alias["@/lib/investigation-runtime"] = resolve("lib/investigation-runtime.node.ts");
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/(?:^@\/lib\/|[\\/]lib[\\/])investigation-runtime(?:\.ts)?$/, resolve("lib/investigation-runtime.node.ts")));
    return config;
  },
};
export default nextConfig;
