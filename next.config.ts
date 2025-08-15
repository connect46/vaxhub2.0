// next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Your Next.js config options can go here if you have any
    eslint: {
    // This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;