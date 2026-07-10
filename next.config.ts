import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module — keep it external so the serverless bundler ships
  // the correct platform binaries (bundling it crashes the upload route on Vercel).
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
