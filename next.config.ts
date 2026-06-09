import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React <ViewTransition> integration — lets route navigations glide
    // (the "double-dolly" carry) instead of hard-swapping. See
    // node_modules/next/dist/docs/.../viewTransition.md
    viewTransition: true,
  },
};

export default nextConfig;
