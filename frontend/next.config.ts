import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@supply/domain", "@supply/database"],
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  experimental: { cpus: 1 },
};

export default nextConfig;
