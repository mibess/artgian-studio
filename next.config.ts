import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // The default config also covers the Cloudflare Worker used by Sites.
    // Vercel should type-check only the native Next.js application surface.
    tsconfigPath:
      process.env.VERCEL_BUILD === "1"
        ? "tsconfig.vercel.json"
        : "tsconfig.json",
  },
};

export default nextConfig;
