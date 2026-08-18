import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep the AWS container build valid during the Vercel rollback window.
  output: "standalone",
  transpilePackages: ["@supply/domain", "@supply/database"],
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  experimental: { cpus: 1 },
};

export default nextConfig;
