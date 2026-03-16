import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App lives in src/frontend/app — override Next.js default
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
