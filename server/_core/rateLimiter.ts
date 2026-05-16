import rateLimit, { type Options as RateLimitOptions } from "express-rate-limit";
import { ENV } from "./env";
import { logger } from "./logger";

// Header name that internal services set to bypass rate limiting
const INTERNAL_SERVICE_HEADER = "x-internal-service";

/**
 * Returns the rate limit store — Redis-backed when REDIS_URL is available,
 * undefined (in-memory) otherwise. This is a singleton resolved at first call.
 */
let _store: unknown | undefined;
let _storeInitialized = false;

async function getStore(): Promise<unknown | undefined> {
  if (_storeInitialized) return _store;
  _storeInitialized = true;

  if (!process.env.REDIS_URL) {
    logger.info("[RateLimiter] No REDIS_URL — using in-memory store");
    return undefined;
  }

  try {
    const { RedisStore } = await import("rate-limit-redis");
    const { createClient } = await import("redis");
    const redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on("error", (err: Error) =>
      logger.warn({ err }, "[RateLimiter] Redis client error"),
    );
    await redisClient.connect();
    _store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    });
    logger.info("[RateLimiter] Using Redis-backed store");
    return _store;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "[RateLimiter] rate-limit-redis unavailable — falling back to memory store",
    );
    return undefined;
  }
}

/**
 * Creates an express-rate-limit middleware instance with:
 * - Redis backing when available
 * - Standard IETF RateLimit headers
 * - Skip in non-production
 * - Skip for X-Internal-Service header matching INTERNAL_SERVICE_SECRET
 */
export async function createLimiter(
  opts: Partial<RateLimitOptions> & { windowMs: number; max: number },
): Promise<ReturnType<typeof rateLimit>> {
  const store = await getStore();
  const { windowMs, max, ...rest } = opts;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: store as RateLimitOptions["store"],
    skip: (req) => {
      // Never rate-limit in dev/test
      if (!ENV.isProduction) return true;
      // Internal service bypass
      if (
        ENV.internalServiceSecret &&
        req.headers[INTERNAL_SERVICE_HEADER] === ENV.internalServiceSecret
      ) {
        return true;
      }
      // Custom skip provided by caller
      if (rest.skip) {
        return typeof rest.skip === "function" ? rest.skip(req, undefined as any) : false;
      }
      return false;
    },
    ...rest,
  } as RateLimitOptions);
}

/**
 * Build all tiered limiters. Called once at server startup.
 */
export async function createAllLimiters() {
  const globalLimiter = await createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window per IP
    message: { error: "Too many requests, please try again later." },
    keyGenerator: (req) => req.ip ?? "unknown",
  });

  const authLimiter = await createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth attempts per 15 min per IP
    message: {
      error: "Too many authentication attempts, please try again later.",
    },
    keyGenerator: (req) => req.ip ?? "unknown",
  });

  const scanLimiter = await createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 scans per hour per userId
    message: { error: "Too many scan triggers, please slow down." },
    keyGenerator: (req) => {
      const apiKey = req.headers["x-api-key"];
      if (typeof apiKey === "string" && apiKey.length > 0) return `scan:${apiKey.slice(0, 8)}`;
      return `scan:${req.ip ?? "unknown"}`;
    },
  });

  const apiKeyLimiter = await createLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 500, // 500 requests per minute per API key (SDK ingest)
    message: { error: "Too many API requests, please slow down." },
    keyGenerator: (req) => {
      const apiKey = req.headers["x-api-key"];
      const auth = req.headers.authorization;
      const key =
        typeof apiKey === "string" && apiKey.length > 0
          ? apiKey.slice(0, 8)
          : typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")
            ? auth.slice(7, 15)
            : (req.ip ?? "unknown");
      return `apikey:${key}`;
    },
  });

  return { globalLimiter, authLimiter, scanLimiter, apiKeyLimiter };
}

/**
 * Routes that the authLimiter applies to.
 */
export const AUTH_ROUTE_PATTERNS = [
  "auth.login",
  "auth.signup",
  "auth.forgotPassword",
  "auth.resetPassword",
];

/**
 * Routes that the scanLimiter applies to.
 */
export const SCAN_ROUTE_PATTERNS = [
  "scanning.trigger",
  "scanning.startScan",
  "vscodeExtension.triggerScan",
];

/**
 * Routes that the apiKeyLimiter applies to (SDK ingest routes).
 */
export const API_KEY_ROUTE_PATTERNS = ["telemetry.ingest", "telemetry.ingestBatch"];
