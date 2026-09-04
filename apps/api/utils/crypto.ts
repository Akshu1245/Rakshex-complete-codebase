/**
 * Simple crypto utilities.
 */
import { createHash, createHmac, randomUUID as nodeRandomUUID, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";

const API_KEY_HASH_CONTEXT = "rakshex:api-key:v1";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomUUID(): string {
  return nodeRandomUUID();
}

/**
 * Legacy digest retained only so existing high-entropy API keys can migrate
 * without an outage. These are 192-bit random tokens, not user passwords.
 */
export function legacyApiKeyHash(apiKey: string): string {
  // codeql[js/insufficient-password-hash]: high-entropy API token lookup digest, not a user password
  return createHash("sha256").update(`${ENV.cookieSecret}:api-key:${apiKey}`).digest("hex");
}

/** Domain-separated HMAC-SHA256 for API key storage (pepper = server secret). */
export function hashApiKey(apiKey: string): string {
  return createHmac("sha256", ENV.cookieSecret)
    .update(API_KEY_HASH_CONTEXT)
    .update("\0")
    .update(apiKey)
    .digest("hex");
}

/**
 * Primary hash for new lookups. Legacy digest is queried separately on miss so
 * gateway auth paths do not eagerly compute the legacy SHA-256 fallback.
 */
export function apiKeyHashCandidates(apiKey: string): string[] {
  return [hashApiKey(apiKey)];
}

/** Constant-time comparison for stored API key hashes. */
export function verifyApiKeyHash(apiKey: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "utf8");
  const candidates = [hashApiKey(apiKey), legacyApiKeyHash(apiKey)];
  return candidates.some((candidate) => {
    const computed = Buffer.from(candidate, "utf8");
    return computed.length === expected.length && timingSafeEqual(computed, expected);
  });
}

/** Display prefix for masked key listings. */
export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}
