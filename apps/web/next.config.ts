import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@supply/domain", "@supply/database"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
