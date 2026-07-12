/**
 * Simple crypto utilities.
 */
import { createHash, randomUUID as nodeRandomUUID, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomUUID(): string {
  return nodeRandomUUID();
}

/** HMAC-SHA256 hash for API key storage (pepper = JWT_SECRET). */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(`${ENV.cookieSecret}:api-key:${apiKey}`).digest("hex");
}

/** Constant-time comparison for stored API key hashes. */
export function verifyApiKeyHash(apiKey: string, storedHash: string): boolean {
  const computed = hashApiKey(apiKey);
  if (computed.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

/** Display prefix for masked key listings. */
export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}
