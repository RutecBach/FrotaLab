import type { NextConfig } from 'next';
import path from 'node:path';
import { apiOrigin } from './lib/api-origin';
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: path.resolve(__dirname, '..') },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};
export default config;
