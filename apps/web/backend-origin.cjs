"use strict";

/**
 * Resolve the legacy Next.js rewrite backend without silently routing a
 * Cloudflare build back to a retired Railway deployment.
 *
 * This boundary is intentionally separate from Cloudflare Worker service
 * bindings. Server-side Worker code should use the binding directly; browser
 * clients and Next.js rewrites require an explicitly configured HTTPS origin.
 */
const LEGACY_RAILWAY_ORIGIN = "https://api-production-0a2b.up.railway.app";

function resolveBackendOrigin(env = process.env) {
  const cloudflare = env.RAKSHEX_DEPLOY_TARGET === "cloudflare";
  const explicit =
    env.RAKSHEX_BACKEND_URL ||
    env.NEXT_PUBLIC_TS_API_URL ||
    env.NEXT_PUBLIC_API_URL;

  if (!cloudflare) {
    // Preserve the existing Railway/Vercel deployment until its replacement
    // is independently proven. No implicit Cloudflare cutover here.
    return (
      env.RAKSHEX_BACKEND_URL ||
      (env.NODE_ENV === "production"
        ? LEGACY_RAILWAY_ORIGIN
        : env.NEXT_PUBLIC_TS_API_URL ||
          env.NEXT_PUBLIC_API_URL ||
          "http://localhost:3000")
    );
  }

  if (!explicit) {
    throw new Error(
      "Cloudflare target requires RAKSHEX_BACKEND_URL or NEXT_PUBLIC_TS_API_URL; refusing Railway fallback",
    );
  }

  let parsed;
  try {
    parsed = new URL(explicit);
  } catch {
    throw new Error("Cloudflare backend origin must be a valid HTTPS URL");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".railway.app")
  ) {
    throw new Error(
      "Cloudflare backend origin must be a clean HTTPS origin outside Railway and localhost",
    );
  }

  if (env.RAKSHEX_CLOUDFLARE_ENV === "staging" && !host.includes("staging")) {
    throw new Error("Cloudflare staging backend must use a staging-specific hostname");
  }

  return parsed.origin;
}

module.exports = { resolveBackendOrigin, LEGACY_RAILWAY_ORIGIN };
