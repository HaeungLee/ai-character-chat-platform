import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // This repo currently has many legacy lint violations (e.g. no-explicit-any)
    // that are not related to runtime behavior. Don't block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
