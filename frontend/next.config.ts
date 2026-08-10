import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next generates AGENTS.md and CLAUDE.md on dev start by default. The repo
  // keeps its own conventions, so opt out rather than carry generated files.
  agentRules: false,
  // The backend serves this build as static files (FastAPI's StaticFiles),
  // so it needs a plain HTML/JS/CSS bundle rather than a Node server.
  output: "export",
  // Without this, `next build` emits out/login.html rather than
  // out/login/index.html, and StaticFiles(html=True)'s directory ->
  // index.html fallback only matches the latter — direct navigation or a
  // refresh on a route like /login would 404.
  trailingSlash: true,
};

export default nextConfig;
