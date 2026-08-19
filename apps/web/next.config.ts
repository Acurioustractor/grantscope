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
  // Report pages query the live database while prerendering, and the default 60s cap is not
  // enough for the slowest of them. Measured 2026-08-20 with CIVICGRAPH_LIVE_REPORTS on:
  //
  //     /reports/community-efficiency   59.6s   ← failed the build 3 attempts running
  //     /reports/board-interlocks       56.4s   ← would be next
  //     /reports/youth-justice/qld/crime-prevention-schools  28.0s
  //     /reports/tax-transparency       27.7s
  //     /reports/philanthropy-power     23.1s
  //
  // Nobody had seen these numbers before, because the flag that makes these pages query anything
  // has been inert since April (#339) — so every build until now prerendered them against an
  // empty stub in milliseconds.
  //
  // Raising the cap rather than marking the slow pages `force-dynamic`: ISR keeps them instant
  // for readers and costs one slow render an hour, where force-dynamic would put the query on
  // every request. The real fix for the two worst is a precomputed matview — `charity_browse`
  // went 10.4s to 92ms that way — and that is tracked separately, not papered over here.
  //
  // Cost: roughly 3 extra minutes of build, against the 45-minute cap noted above. `cpus: 2`
  // already bounds how many of these run at once, which also keeps them off the shared pooler.
  staticPageGenerationTimeout: 180,
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
