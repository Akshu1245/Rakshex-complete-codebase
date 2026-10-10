/**
 * OAuth 2.0 state + PKCE (S256) helpers for Google/GitHub authorization code flows.
 * State and code_verifier are stored in Redis (or an in-memory fallback) with a short TTL.
 *
 * Security invariants:
 * - stored payloads are runtime-validated before use (never trusted after JSON.parse)
 * - state is single-use and provider-bound
 * - PKCE verifiers use the RFC 7636 character set and length
 * - post-login redirects are same-origin relative paths only
 */
import crypto from "crypto";
import { z } from "zod";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";

const OAUTH_STATE_TTL_SEC = 600; // 10 minutes
const OAUTH_STATE_TTL_MS = OAUTH_STATE_TTL_SEC * 1000;
const CLOCK_SKEW_MS = 60_000;
const MAX_REDIRECT_LENGTH = 2048;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

const oauthPendingSchema = z
  .object({
    provider: z.enum(["google", "github"]),
    codeVerifier: z
      .string()
      .min(43)
      .max(128)
      .regex(/^[A-Za-z0-9._~-]+$/),
    redirectAfter: z.string().max(MAX_REDIRECT_LENGTH).optional(),
    createdAt: z.number().int().positive(),
  })
  .strict();

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function deriveCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export interface OAuthPending {
  provider: "google" | "github";
  codeVerifier: string;
  redirectAfter?: string;
  createdAt: number;
}

/**
 * Convert an untrusted redirect target into a safe same-origin relative URL.
 * Absolute URLs, protocol-relative URLs, backslash variants and header-injection
 * characters are rejected. Invalid values fall back to the caller's default route.
 */
export function normalizeRedirectAfter(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_REDIRECT_LENGTH) {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("\\") || /[\r\n]/.test(value) || /%0d|%0a/i.test(value)) return undefined;

  try {
    const base = new URL("https://rakshex.invalid");
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

function stateKey(state: string): string {
  return `oauth:state:${state}`;
}

async function setWithTtl(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    await redis.set(key, value, "EX", ttlSec);
  } catch {
    memoryStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
}

async function getAndDelete(key: string): Promise<string | null> {
  try {
    const val = await redis.get(key);
    if (val) {
      await redis.del(key);
      return val;
    }
  } catch {
    // Fall through to the process-local fallback when Redis is unavailable.
  }

  const mem = memoryStore.get(key);
  memoryStore.delete(key);
  if (!mem || mem.expiresAt < Date.now()) return null;
  return mem.value;
}

export async function storeOAuthPending(state: string, pending: OAuthPending): Promise<void> {
  const candidate = {
    ...pending,
    redirectAfter: normalizeRedirectAfter(pending.redirectAfter),
  };
  const validated = oauthPendingSchema.parse(candidate);
  await setWithTtl(stateKey(state), JSON.stringify(validated), OAUTH_STATE_TTL_SEC);
}

/**
 * Consume OAuth state (single-use). Returns null if missing, expired, malformed,
 * stale, type-confused, or bound to another provider.
 */
export async function consumeOAuthPending(
  state: string | undefined,
  provider: "google" | "github",
): Promise<OAuthPending | null> {
  if (!state || state.length < 8 || state.length > 256) {
    logger.warn({ provider }, "[OAuth] Missing or invalid state parameter");
    return null;
  }

  const raw = await getAndDelete(stateKey(state));
  if (!raw) {
    logger.warn({ provider }, "[OAuth] State not found or already used");
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(raw);
    const result = oauthPendingSchema.safeParse(decoded);
    if (!result.success) {
      logger.warn({ provider }, "[OAuth] Stored state payload failed validation");
      return null;
    }

    const pending = result.data;
    if (pending.provider !== provider) {
      logger.warn({ provider, stored: pending.provider }, "[OAuth] Provider mismatch");
      return null;
    }

    const ageMs = Date.now() - pending.createdAt;
    if (ageMs < -CLOCK_SKEW_MS || ageMs > OAUTH_STATE_TTL_MS + CLOCK_SKEW_MS) {
      logger.warn({ provider }, "[OAuth] Stored state payload is stale");
      return null;
    }

    return {
      ...pending,
      redirectAfter: normalizeRedirectAfter(pending.redirectAfter),
    };
  } catch {
    logger.warn({ provider }, "[OAuth] Stored state payload is not valid JSON");
    return null;
  }
}
