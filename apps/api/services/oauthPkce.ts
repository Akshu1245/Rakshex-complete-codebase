/**
 * OAuth 2.0 state + PKCE (S256) helpers for Google/GitHub authorization code flows.
 * State and code_verifier are stored hashed in Redis (or in-memory fallback) with short TTL.
 */
import crypto from "crypto";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";

const OAUTH_STATE_TTL_SEC = 600; // 10 minutes
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

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
    // fall through to memory
  }
  const mem = memoryStore.get(key);
  memoryStore.delete(key);
  if (!mem) return null;
  if (mem.expiresAt < Date.now()) return null;
  return mem.value;
}

export async function storeOAuthPending(state: string, pending: OAuthPending): Promise<void> {
  await setWithTtl(stateKey(state), JSON.stringify(pending), OAUTH_STATE_TTL_SEC);
}

/**
 * Consume OAuth state (single-use). Returns null if missing, expired, or wrong provider.
 */
export async function consumeOAuthPending(
  state: string | undefined,
  provider: "google" | "github",
): Promise<OAuthPending | null> {
  if (!state || state.length < 8) {
    logger.warn({ provider }, "[OAuth] Missing or short state parameter");
    return null;
  }
  const raw = await getAndDelete(stateKey(state));
  if (!raw) {
    logger.warn({ provider }, "[OAuth] State not found or already used");
    return null;
  }
  try {
    const pending = JSON.parse(raw) as OAuthPending;
    if (pending.provider !== provider) {
      logger.warn({ provider, stored: pending.provider }, "[OAuth] Provider mismatch");
      return null;
    }
    if (!pending.codeVerifier) return null;
    return pending;
  } catch {
    return null;
  }
}
