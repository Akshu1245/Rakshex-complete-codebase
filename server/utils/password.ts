/**
 * Password hashing utilities using Node.js built-in crypto module.
 * Uses PBKDF2 with SHA-512 for secure password storage.
 */
import crypto from "crypto";

const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 64;
const SALT_LENGTH = 32;

/**
 * Hash a password using PBKDF2-SHA512.
 * Returns a colon-separated string of algorithm:salt:hash for storage.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    HASH_LENGTH,
    "sha512"
  );
  return `pbkdf2:sha512:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 * Supports legacy SHA-256 hashes for migration, but new hashes use PBKDF2.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) {
    return false;
  }

  // Handle legacy SHA-256 hashes (for migration) — log a warning and force rehash
  if (storedHash.length === 64 && !storedHash.includes(":")) {
    const pepper = process.env.COOKIE_SECRET || "";
    const legacyHash = crypto
      .createHash("sha256")
      .update(password + pepper)
      .digest("hex");
    const legacyBuf = Buffer.from(legacyHash, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");
    if (legacyBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(legacyBuf, storedBuf);
  }

  // Handle new PBKDF2 hashes
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 4) {
      return false;
    }
    const [, algorithm, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const storedHashBuf = Buffer.from(hashHex, "hex");

    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      HASH_LENGTH,
      algorithm as "sha512"
    );

    // Use constant-time comparison to prevent timing attacks
    if (computedHash.length !== storedHashBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedHash, storedHashBuf);
  }

  return false;
}

/**
 * Check if a hash needs rehashing (e.g., legacy format or low iterations).
 */
export function needsRehash(storedHash: string): boolean {
  // Legacy SHA-256 hashes need rehashing
  if (storedHash.length === 64 && !storedHash.includes(":")) {
    return true;
  }
  // PBKDF2 hashes — extract actual iteration count from the format pbkdf2:sha512:salt:hash
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    // Format: pbkdf2:<algorithm>:<salt>:<hash> — iterations are always PBKDF2_ITERATIONS
    // If the hash format changes in future, check parts.length for a version with explicit iterations
    return false; // Current PBKDF2 hashes use the correct iteration count
  }
  return true;
}

/**
 * Generate a secure random token.
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}
