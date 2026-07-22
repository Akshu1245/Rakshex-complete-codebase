const path = require("path");

/** @type {import('next').NextConfig} */
const TS_BACKEND_URL =
  process.env.NEXT_PUBLIC_TS_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const nextConfig = {
  // This project sits inside a larger local workspace that has its own lock
  // file. Pin tracing here so production builds never walk the parent tree.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Don't advertise Next.js in response headers. Attackers can still
  // fingerprint us via HTML quirks, but no reason to make it trivial.
  poweredByHeader: false,
  // Never emit browser source maps for production. Makes the deployed
  // JS significantly harder to reverse-engineer into original TS.
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Enforce TypeScript during production builds. ESLint runs as a separate CI gate.
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    // SWC drops `console.*` calls (except console.error) from production
    // bundles. Smaller output + zero debug noise leaked to end users.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  // Extra hardening headers for every HTML / static asset response.
  // (API requests proxy through to the TS backend where helmet already
  // adds the full suite of headers.)
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss: https://api.rakshex.in https://*.sentry.io https://script.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // All API traffic goes to the Node tRPC backend. The legacy Python
      // FastAPI service has been retired; do not proxy unknown /api/* to a
      // dead host or pages will silently 404 in production.
      {
        source: "/api/oauth/:path*",
        destination: `${TS_BACKEND_URL}/api/oauth/:path*`,
      },
      {
        source: "/api/trpc/:path*",
        destination: `${TS_BACKEND_URL}/api/trpc/:path*`,
      },
      {
        source: "/api/health",
        destination: `${TS_BACKEND_URL}/api/health`,
      },
      {
        source: "/api/create-order",
        destination: `${TS_BACKEND_URL}/api/create-order`,
      },
      {
        source: "/api/verify-payment",
        destination: `${TS_BACKEND_URL}/api/verify-payment`,
      },
      {
        source: "/api/waitlist",
        destination: `${TS_BACKEND_URL}/api/waitlist`,
      },
      // Competitor / collection migration import API (preview, execute, history,
      // supported-sources) is served by the Node backend, not Next.
      {
        source: "/api/import/:path*",
        destination: `${TS_BACKEND_URL}/api/import/:path*`,
      },
      // Public quick-scan lead magnet (no auth) served by the Node backend.
      {
        source: "/api/public/:path*",
        destination: `${TS_BACKEND_URL}/api/public/:path*`,
      },
    ];
  },
  // Bundle splitting: extract vendor chunks and enable code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|next|@trpc|lucide-react|date-fns)[\\/]/,
            name: "vendor-core",
            chunks: "all",
            priority: 20,
          },
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3|victory)[\\/]/,
            name: "vendor-charts",
            chunks: "async",
            priority: 15,
          },
          commons: {
            name: "commons",
            minChunks: 2,
            priority: 5,
          },
        },
        maxInitialRequests: 25,
        minSize: 20000,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
