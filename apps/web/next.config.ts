import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@grantscope/engine'],
  webpack: (config) => {
    // Resolve .js imports to .ts files in workspace packages (ESM convention)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
