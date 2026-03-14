import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
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
