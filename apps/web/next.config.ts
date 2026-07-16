import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@supply/domain", "@supply/database"],
  outputFileTracingRoot: process.cwd(),
  experimental: { cpus: 1 },
};

export default nextConfig;
