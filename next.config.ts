import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node.js-only packages that must not be bundled by webpack/Turbopack.
  // On Cloudflare edge these will be unavailable at runtime — all callers
  // handle the failure gracefully (try/catch → null/empty returns).
  // serverExternalPackages: only truly Node.js-only packages that must NOT be
  // bundled. drizzle-orm/neon-http and @neondatabase/serverless are edge-
  // compatible (HTTP mode) so they must NOT be listed here — listing them
  // causes Next.js to downgrade routes that import them to Node.js runtime,
  // breaking Cloudflare Pages edge deployment.
  // googleapis / google-auth-library are imported dynamically in connectors.
  serverExternalPackages: [
    "@notionhq/notion-mcp-server",
    "@ai-sdk/mcp",
  ],
};

export default nextConfig;
