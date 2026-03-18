import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages are server-only and must NOT be bundled by Turbopack/webpack.
  // Without this, Next.js tries to statically analyse + bundle them, which causes
  // extreme memory pressure and can hang compilation entirely.
  //   googleapis@171  — massive (hundreds of API modules)
  //   google-auth-library — heavy OAuth2 client
  //   drizzle-orm — has native bindings that can't be bundled
  //   @neondatabase/serverless — HTTP driver, uses native crypto
  serverExternalPackages: [
    "@neondatabase/serverless",
    "googleapis",
    "google-auth-library",
    "drizzle-orm",
  ],
};

export default nextConfig;
