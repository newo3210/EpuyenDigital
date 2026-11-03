import type { NextConfig } from "next";

// Next config - minimal App Router web for webhook + health
const nextConfig: NextConfig = {
  transpilePackages: ["@epuyen/shared"],
};

export default nextConfig;
