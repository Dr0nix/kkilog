import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kkilog/domain', '@kkilog/contracts'],
  // 프롬프트는 런타임에 파일로 읽으므로 배포 번들에 포함시킨다.
  outputFileTracingIncludes: {
    '/api/**': ['./prompts/**/*'],
  },
};

export default nextConfig;
