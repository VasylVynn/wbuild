import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module — keep it external so the serverless bundler ships
  // the correct platform binaries (bundling it crashes the upload route on Vercel).
  serverExternalPackages: ["sharp"],
  // Verification builds must not clobber the dev server's .next (a build while
  // `next dev` runs corrupts its chunks → 404 CSS/JS). CI/Vercel ignore this env.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
