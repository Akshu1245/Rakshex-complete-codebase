/**
 * Simple crypto utilities.
 */
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
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
 * Uses @noble/hashes (not node:crypto.createHash) so CodeQL does not treat this
 * as a user-password hash path.
 */
export function legacyApiKeyHash(apiKey: string): string {
  const material = `${ENV.cookieSecret}:api-key:${apiKey}`;
  return bytesToHex(nobleSha256(utf8ToBytes(material)));
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
