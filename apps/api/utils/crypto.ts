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
function legacyApiKeyHash(apiKey: string): string {
  // codeql[js/insufficient-password-hash]
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
 * Primary hash first, followed by the pre-HMAC digest for seamless,
 * authenticate-then-upgrade migration.
 */
export function apiKeyHashCandidates(apiKey: string): string[] {
  const primary = hashApiKey(apiKey);
  const legacy = legacyApiKeyHash(apiKey);
  return primary === legacy ? [primary] : [primary, legacy];
}

/** Constant-time comparison for stored API key hashes. */
export function verifyApiKeyHash(apiKey: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "utf8");
  return apiKeyHashCandidates(apiKey).some((candidate) => {
    const computed = Buffer.from(candidate, "utf8");
    return computed.length === expected.length && timingSafeEqual(computed, expected);
  });
}

/** Display prefix for masked key listings. */
export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}
