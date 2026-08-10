import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next generates AGENTS.md and CLAUDE.md on dev start by default. The repo
  // keeps its own conventions, so opt out rather than carry generated files.
  agentRules: false,
};

export default nextConfig;
