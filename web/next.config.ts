import type { NextConfig } from 'next';

// In live mode the browser calls same-origin /api/* and /media/*, and Next.js forwards them to the
// Nginx gateway. That keeps cookies first-party (refresh token) and avoids CORS in development.
// In production you can instead put the web app and the gateway behind the same Nginx host.
const gateway = process.env.API_GATEWAY_INTERNAL_URL; // e.g. http://gateway:8080 inside docker-compose

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    if (!gateway) return [];
    return [
      { source: '/api/:path*', destination: `${gateway}/api/:path*` },
      { source: '/media/:path*', destination: `${gateway}/media/:path*` },
    ];
  },
};

export default nextConfig;
