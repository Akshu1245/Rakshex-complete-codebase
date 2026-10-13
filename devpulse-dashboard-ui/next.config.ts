import type { NextConfig } from "next";
const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // HTTP routes resolve BACKEND_URL at runtime; this rewrite handles upgrades in local Next.js hosting.
    return [{ source: '/ws/:path*', destination: `${backendUrl}/ws/:path*` }];
  },
};
export default nextConfig;
