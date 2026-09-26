try {
  const { AsyncLocalStorage } = require("node:async_hooks");
  if (typeof globalThis !== "undefined" && !globalThis.AsyncLocalStorage) {
    globalThis.AsyncLocalStorage = AsyncLocalStorage;
  }
} catch (e) {
  // ignore — AsyncLocalStorage polyfill is best-effort
}

const path = require("path");

/** @type {import('next').NextConfig} */
const RAILWAY_PRODUCTION_API_URL = "https://api-production-0a2b.up.railway.app";
// Cloudflare Workers builds run with CF_WORKERS_BUILD=1 (see package.json
// build:cf, via cross-env for Windows compat). In that mode the Railway
// fallback below is disabled and the build fails fast when no API origin is
// configured — a Workers build must never bake in the Railway URL.
const IS_CF_BUILD = process.env.CF_WORKERS_BUILD === "1";
const CONFIGURED_API_ORIGIN = (
  process.env.RAKSHEX_BACKEND_URL ||
  process.env.RAKSHEX_API_URL ||
  process.env.RAKSHEX_API_ORIGIN ||
  ""
).trim();
function resolveBackendUrl() {
  if (CONFIGURED_API_ORIGIN) return CONFIGURED_API_ORIGIN.replace(/\/+$/, "");
  if (IS_CF_BUILD) {
    throw new Error(
      "[cloudflare] RAKSHEX_BACKEND_URL (or RAKSHEX_API_ORIGIN) must be set when " +
        "building for Cloudflare Workers — refusing to bake the Railway fallback " +
        "into the Workers build. Example: RAKSHEX_API_ORIGIN=https://rakshex-firewall.<subdomain>.workers.dev pnpm build:cf",
    );
  }
  if (process.env.NODE_ENV === "production") return RAILWAY_PRODUCTION_API_URL;
  return (
    process.env.NEXT_PUBLIC_TS_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  );
}
const TS_BACKEND_URL = resolveBackendUrl();

// CSP connect-src is derived from the resolved backend origin so the Workers
// build never whitelists Railway/Render hosts. (Vercel keeps the legacy
// api.rakshex.in entry; Cloudflare drops it.)
function cspConnectSrc() {
  const src = ["'self'", "wss:", "https://*.sentry.io", "https://script.google.com"];
  // TS_BACKEND_URL is validated to be an http(s) origin string above; a
  // regex keeps this working under the repo's eslint env (no URL global).
  const m = /^https?:\/\/[^/]+/.exec(TS_BACKEND_URL);
  if (m) {
    src.push(m[0]);
    const wsOrigin = m[0].replace(/^http/, "ws");
    if (!src.includes(wsOrigin)) src.push(wsOrigin);
  }
  if (!IS_CF_BUILD) src.push("https://api.rakshex.in");
  return src.join(" ");
}

const nextConfig = {
  serverExternalPackages: ["async_hooks"],
  // Build-time flag so server code can drop legacy backend fallbacks from the
  // Workers bundle entirely (Next inlines `env` values at build time).
  env: {
    RAKSHEX_CF_BUILD: IS_CF_BUILD ? "1" : "",
  },
  // This project sits inside a larger local workspace that has its own lock
  // file. Pin tracing here so production builds never walk the parent tree.
  outputFileTracingRoot: path.join(__dirname, "../.."),
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
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src " +
              cspConnectSrc() +
              "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Public aliases and legacy URLs must resolve before auth middleware or
      // stale external links can turn into login bounces / soft 404s.
      {
        source: "/documentation",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/getting-started",
        destination: "/docs/agent-firewall",
        permanent: true,
      },
      {
        source: "/dpa",
        destination: "/legal/dpa",
        permanent: true,
      },
      {
        source: "/legal/terms",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/legal/privacy",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/compare/rakshex-vs-snyk",
        destination: "/compare/snyk",
        permanent: true,
      },
      {
        source: "/compare/rakshex-vs-datadog",
        destination: "/compare/datadog",
        permanent: true,
      },
      {
        source: "/compare/rakshex-vs-salt",
        destination: "/compare/salt-security",
        permanent: true,
      },
      {
        source: "/compare/rakshex-vs-traceable",
        destination: "/compare/traceable-ai",
        permanent: true,
      },
      {
        source: "/roi-calculator",
        destination: "/pricing",
        permanent: true,
      },
      {
        source: "/roi-calculator/:path*",
        destination: "/pricing",
        permanent: true,
      },
      {
        source: "/blog/helicone-alternative",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/lakera-alternative",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/portkey-alternative",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/snyk-alternative",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/security.txt",
        destination: "/.well-known/security.txt",
        permanent: true,
      },
      {
        source: "/legal/rakshex-terms-of-service.docx",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/legal/rakshex-refund-cancellation-policy.docx",
        destination: "/legal/refund",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // All API traffic goes to the TS backend. Origin resolution (top of this
      // file): RAKSHEX_BACKEND_URL / RAKSHEX_API_ORIGIN win when set; the
      // Cloudflare build fails fast without one; Vercel production falls back
      // to the known Railway origin. The legacy Python/Vercel backend is retired.
      {
        source: "/api/oauth/:path*",
        destination: `${TS_BACKEND_URL}/api/oauth/:path*`,
      },
      {
        source: "/api/trpc/:path*",
        destination: `${TS_BACKEND_URL}/api/trpc/:path*`,
      },
      // NOTE: /api/health is served by app/api/health/route.ts (native proxy
      // to the Workers API /v1/health). External-URL rewrites are not honored
      // by the Cloudflare adapter, so no /api/* -> API-origin rewrites here.
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
      {
        source: "/api/import/:path*",
        destination: `${TS_BACKEND_URL}/api/import/:path*`,
      },
    ];
  },
  // Bundle splitting: extract vendor chunks and enable code splitting
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
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
