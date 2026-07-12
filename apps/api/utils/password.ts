/**
 * Password hashing with Argon2id (primary) and PBKDF2/legacy fallbacks for migration.
 * Never stores plaintext passwords.
 */
import crypto from "crypto";
import { argon2id } from "@noble/hashes/argon2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 64;
const SALT_LENGTH = 32;

/**
 * Argon2id parameters.
 * Pure-JS (@noble/hashes) is slower than native argon2; 19 MiB / t=2
 * matches OWASP's minimum interactive guidance without multi-second logins.
 */
const ARGON2_OPTS = {
  t: 2, // time cost
  m: 19456, // ~19 MiB
  p: 1, // parallelism
  dkLen: 32,
} as const;

/**
 * Hash a password with Argon2id.
 * Format: argon2id$v=19$m=65536,t=3,p=1$<salt_hex>$<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = argon2id(password, salt, ARGON2_OPTS);
  return `argon2id$v=19$m=${ARGON2_OPTS.m},t=${ARGON2_OPTS.t},p=${ARGON2_OPTS.p}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Verify a password against a stored hash.
 * Supports Argon2id, PBKDF2-SHA512, and legacy SHA-256.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) {
    return false;
  }

  // Argon2id (primary)
  if (storedHash.startsWith("argon2id$")) {
    try {
      const parts = storedHash.split("$");
      // argon2id $ v=19 $ m=...,t=...,p=... $ salt $ hash
      if (parts.length !== 5) return false;
      const paramPart = parts[2]!;
      const saltHex = parts[3]!;
      const hashHex = parts[4]!;
      const m = Number(/m=(\d+)/.exec(paramPart)?.[1] ?? ARGON2_OPTS.m);
      const t = Number(/t=(\d+)/.exec(paramPart)?.[1] ?? ARGON2_OPTS.t);
      const p = Number(/p=(\d+)/.exec(paramPart)?.[1] ?? ARGON2_OPTS.p);
      const salt = hexToBytes(saltHex);
      const expected = hexToBytes(hashHex);
      const computed = argon2id(password, salt, { t, m, p, dkLen: expected.length });
      if (computed.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // Legacy SHA-256 (pre-PBKDF2)
  if (storedHash.length === 64 && !storedHash.includes(":") && !storedHash.includes("$")) {
    const pepper = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "";
    const legacyHash = crypto
      .createHash("sha256")
      .update(password + pepper)
      .digest("hex");
    const legacyBuf = Buffer.from(legacyHash, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");
    if (legacyBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(legacyBuf, storedBuf);
  }

  // PBKDF2 (previous primary)
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 4) {
      return false;
    }
    const [, algorithm, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex!, "hex");
    const storedHashBuf = Buffer.from(hashHex!, "hex");

    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      HASH_LENGTH,
      algorithm as "sha512",
    );

    if (computedHash.length !== storedHashBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedHash, storedHashBuf);
  }

  return false;
}

/**
 * True when the stored hash should be upgraded to Argon2id on next successful login.
 */
export function needsRehash(storedHash: string): boolean {
  if (!storedHash) return true;
  if (storedHash.startsWith("argon2id$")) {
    const paramPart = storedHash.split("$")[2] ?? "";
    const m = Number(/m=(\d+)/.exec(paramPart)?.[1] ?? 0);
    const t = Number(/t=(\d+)/.exec(paramPart)?.[1] ?? 0);
    return m < ARGON2_OPTS.m || t < ARGON2_OPTS.t;
  }
  return true;
}

/**
 * Generate a secure random token (hex).
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash opaque tokens (password reset, email verify, recovery codes) with SHA-256.
 * Raw tokens are never stored.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
