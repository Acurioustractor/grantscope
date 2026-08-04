import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // `next build`'s lint + whole-project typecheck phase intermittently hangs on
  // Vercel's 4-core/8GB builder and gets killed at the 45-min build cap. Both are
  // already gated in CI (ci.yml `typecheck` job runs `tsc --noEmit`), so running
  // them again here is pure redundancy that wedges deploys. Skip them in the build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    externalDir: true,
    // Vercel's 4-core/8GB builder OOM-SIGKILLs this build repeatedly. Fewer
    // static-generation workers + webpack memory trimming keeps the total
    // footprint of all build processes inside the container.
    cpus: 2,
    webpackMemoryOptimizations: true,
  },
  serverExternalPackages: ['playwright', 'playwright-core'],
  turbopack: {
    resolveAlias: {
      playwright: './src/lib/shims/empty-module.ts',
      'playwright-core': './src/lib/shims/empty-module.ts',
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  webpack: (config) => {
    // Resolve .js imports to .ts files in workspace packages (ESM convention)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };

    // Exclude playwright from all bundles — it's only used in standalone scripts
    config.resolve.alias = {
      ...config.resolve.alias,
      'playwright': false,
      'playwright-core': false,
    };

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
