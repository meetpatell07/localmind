import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node.js-only packages that must not be bundled by webpack/Turbopack.
  // On Cloudflare edge these will be unavailable at runtime — all callers
  // handle the failure gracefully (try/catch → null/empty returns).
  serverExternalPackages: [
    "@neondatabase/serverless",
    "googleapis",
    "google-auth-library",
    "drizzle-orm",
    "@notionhq/notion-mcp-server",
    "@ai-sdk/mcp",
    // @huggingface/transformers is dynamically imported — NOT listed here
    // so the bundler can tree-shake it. The dynamic import fails silently
    // on edge and embeddings return null (memory search degrades gracefully).
  ],
};

export default nextConfig;
