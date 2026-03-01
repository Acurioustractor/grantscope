import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@grantscope/engine'],
  serverExternalPackages: ['playwright', 'playwright-core'],
  webpack: (config, { isServer }) => {
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

export default nextConfig;
