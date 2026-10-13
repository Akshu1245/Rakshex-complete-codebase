import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';
const hasExplicitBackendUrl = Boolean(process.env.BACKEND_URL);

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['*'],
  async rewrites() {
    // On Vercel production, keep /api local unless BACKEND_URL is explicitly provided.
    // This supports both single-project deploys and split frontend/backend deploys.
    if (isVercel && isProduction && !hasExplicitBackendUrl) {
      return [];
    }
    
    // In local dev, proxy API requests to the backend server
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
      {
        source: '/openapi.json',
        destination: `${backendUrl}/openapi.json`,
      },
      {
        source: '/backend-docs',
        destination: `${backendUrl}/docs`,
      },
    ];
  },
};

export default nextConfig;
