import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import { parsePublicEnv } from './src/infrastructure/env';

// Monorepo root - pinned so a stray lockfile in a parent folder is never picked as root.
const repoRoot = path.resolve(__dirname, '../..');

// Environment bootstrap - loads the repo-root .env.local and fails fast on missing variables.
// forceReload: Next caches its own apps/web env load, which would make this call a no-op.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production', console, true);
parsePublicEnv(process.env);

// Next.js config - compiles the TypeScript-source shared workspace package.
const nextConfig: NextConfig = {
  transpilePackages: ['@epuyen/shared'],
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
};

export default nextConfig;
