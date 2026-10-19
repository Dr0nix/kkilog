import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kkilog/domain', '@kkilog/contracts'],
};

export default nextConfig;
