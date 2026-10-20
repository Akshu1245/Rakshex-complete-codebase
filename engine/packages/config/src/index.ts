/**
 * @rakshex/config — shared environment naming and defaults.
 * TODO(foundation): migrate apps/api env validation (server/_core/env.ts) here
 * without inventing runtime secrets or product features.
 */

export const PRODUCT_NAME = "Rakshex" as const;
export const PACKAGE_SCOPE = "@rakshex" as const;
export const ENV_PREFIX = "RAKSHEX_" as const;
export const DEFAULT_DB_NAME = "rakshex" as const;
export const DEFAULT_DOCKER_NAMESPACE = "rakshex" as const;

/** Public env var names (no values). */
export const ENV_KEYS = {
  DATABASE_URL: "DATABASE_URL",
  REDIS_URL: "REDIS_URL",
  JWT_SECRET: "JWT_SECRET",
  APP_URL: "APP_URL",
  FRONTEND_URL: "FRONTEND_URL",
  RAKSHEX_VAULT_KEY: "RAKSHEX_VAULT_KEY",
  NODE_ENV: "NODE_ENV",
  PORT: "PORT",
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export interface RakshexPublicConfig {
  productName: typeof PRODUCT_NAME;
  packageScope: typeof PACKAGE_SCOPE;
  envPrefix: typeof ENV_PREFIX;
  defaultDbName: typeof DEFAULT_DB_NAME;
}

export function getPublicConfig(): RakshexPublicConfig {
  return {
    productName: PRODUCT_NAME,
    packageScope: PACKAGE_SCOPE,
    envPrefix: ENV_PREFIX,
    defaultDbName: DEFAULT_DB_NAME,
  };
}
