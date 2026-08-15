import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle in .next/standalone so the runtime
  // image does not need node_modules.
  output: "standalone",

  // Pin the workspace root. Without this Next walks upwards looking for a
  // lockfile, and any stray package-lock.json in a parent directory (e.g. the
  // user's home dir) silently changes where standalone output is written --
  // server.js ends up nested under .next/standalone/<relative-path>/ and the
  // Docker COPY misses it.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
