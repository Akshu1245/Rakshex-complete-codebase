/**
 * Explicit CORS origin allowlist builder.
 *
 * No wildcard matching (e.g. *.vercel.app / *.insforge.site) — each origin
 * must be listed via FRONTEND_URL or CORS_ORIGINS.
 */

export interface CorsAllowlistInput {
  isProduction: boolean;
  frontendUrl: string;
  corsOrigins: string;
}

function uniqNonEmpty(values: string[]): string[] {
  return values.filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);
}

export function buildCorsAllowlist(input: CorsAllowlistInput): string[] {
  const fromEnv = (input.corsOrigins || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (input.isProduction) {
    // Explicit origins only — no *.vercel.app / *.insforge.site wildcards.
    // Known production frontends must be listed by exact origin.
    return uniqNonEmpty([
      "https://rakshex.in",
      "https://www.rakshex.in",
      "https://yc7y9pq9.insforge.site",
      "https://app.devpulse.ai",
      input.frontendUrl,
      ...fromEnv,
    ]);
  }

  return uniqNonEmpty([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
    input.frontendUrl,
    ...fromEnv,
  ]);
}
