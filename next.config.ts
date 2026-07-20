import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained .next/standalone build (minimal traced
  // node_modules + server.js) so the Docker runner stage doesn't need
  // the full node_modules tree or the Next.js CLI at runtime.
  output: "standalone",
};

export default nextConfig;
