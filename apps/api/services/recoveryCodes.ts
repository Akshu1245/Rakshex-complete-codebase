/**
 * MFA recovery codes — hashed at rest, single-use.
 */
import crypto from "crypto";
import { hashToken } from "../utils/password";

const CODE_COUNT = 10;
const CODE_BYTES = 5; // 10 hex chars per code segment → readable XXXX-XXXX

export function generateRecoveryCodes(count: number = CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(CODE_BYTES).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return hashToken(normalizeRecoveryCode(code));
}

export function hashRecoveryCodes(codes: string[]): string[] {
  return codes.map(hashRecoveryCode);
}

/**
 * Attempt to consume a recovery code against stored hashes.
 * Returns the remaining hashes if match, or null if no match.
 */
export function consumeRecoveryCode(presented: string, storedHashes: string[]): string[] | null {
  const presentedHash = hashRecoveryCode(presented);
  const idx = storedHashes.findIndex((h) => {
    try {
      const a = Buffer.from(h, "hex");
      const b = Buffer.from(presentedHash, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return h === presentedHash;
    }
  });
  if (idx < 0) return null;
  return storedHashes.filter((_, i) => i !== idx);
}
