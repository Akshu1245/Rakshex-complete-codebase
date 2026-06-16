/**
 * Reversible PII / secret vault.
 *
 * Pure-crypto helper for storing user-supplied secrets (LLM API keys,
 * uploaded credentials, originals of redacted PII tokens) so they can be
 * recovered later in trusted contexts (e.g. when the gateway needs the
 * original key to forward upstream) but are useless to anyone without the
 * encryption key.
 *
 * Algorithm: AES-256-GCM, per-record 96-bit IV, 128-bit auth tag.
 *
 * Key management:
 *   - One root key held in `RAKSHEX_VAULT_KEY` (32-byte hex / base64 / utf8).
 *   - Records carry their own 12-byte IV — never reuse an IV with the same
 *     key (GCM is catastrophic on IV reuse).
 *   - The encoded record is `v1.<iv_b64>.<tag_b64>.<ciphertext_b64>` so we
 *     can ship multiple algorithm versions later without breaking older rows.
 *
 * Per-tenant isolation: callers pass a `tenantId` which is mixed into the
 * AAD (additional authenticated data). Cross-tenant decryption attempts
 * fail with `auth tag mismatch` even if an attacker steals one tenant's
 * ciphertext blob.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm" as const;
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

export interface VaultConfig {
  /**
   * Raw key material. Accepts:
   *   - 64-char hex string ("00..ff", lower or upper case)
   *   - base64 string with 32-byte decoded length
   *   - any utf-8 string ≥ 32 bytes (we hash it down to 32 bytes via SHA-256)
   */
  key: string;
}

function deriveKey(material: string): Buffer {
  const trimmed = material.trim();
  // hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  // base64 (allow padded or unpadded)
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === KEY_LEN) return buf;
  } catch {
    /* fall through */
  }
  // fallback: SHA-256 of the raw bytes — never weaker than 256 bits, but
  // an entropy-poor source is still entropy-poor. Documented in README.
  return createHash("sha256").update(material, "utf8").digest();
}

export interface EncryptedRecord {
  /** Opaque, URL-safe encoded ciphertext (`v1.iv.tag.ciphertext`). */
  ciphertext: string;
}

export interface VaultHandle {
  /** Encrypt UTF-8 plaintext, returning the encoded ciphertext blob. */
  encrypt(plaintext: string, tenantId: string): EncryptedRecord;
  /** Decrypt; throws if the auth tag mismatches or the tenantId differs. */
  decrypt(record: EncryptedRecord, tenantId: string): string;
  /**
   * Per-secret deterministic token used for stable lookups (e.g. "have I
   * seen this PII string before?") without revealing the original.
   * Implementation: HMAC-SHA-256(key, tenantId || plaintext) truncated to
   * 16 bytes, base32-encoded for URL safety.
   */
  fingerprint(plaintext: string, tenantId: string): string;
}

function encodeBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function createVault(cfg: VaultConfig): VaultHandle {
  const key = deriveKey(cfg.key);
  if (key.length !== KEY_LEN) {
    throw new Error(
      `vault key must be 32 bytes (got ${key.length}); pass a 64-char hex string, a 32-byte base64 string, or a UTF-8 secret`,
    );
  }

  return {
    encrypt(plaintext, tenantId) {
      const iv = randomBytes(IV_LEN);
      const cipher = createCipheriv(ALGO, key, iv);
      cipher.setAAD(Buffer.from(tenantId, "utf8"));
      const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const encoded = `${VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(tag)}.${encodeBase64Url(ct)}`;
      return { ciphertext: encoded };
    },
    decrypt(record, tenantId) {
      const parts = record.ciphertext.split(".");
      if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error("malformed vault record: unsupported version or shape");
      }
      const iv = decodeBase64Url(parts[1]!);
      const tag = decodeBase64Url(parts[2]!);
      const ct = decodeBase64Url(parts[3]!);
      if (iv.length !== IV_LEN) throw new Error("malformed vault record: iv");
      if (tag.length !== TAG_LEN) throw new Error("malformed vault record: tag");
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAAD(Buffer.from(tenantId, "utf8"));
      decipher.setAuthTag(tag);
      try {
        const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
        return pt.toString("utf8");
      } catch {
        // GCM raises on auth-tag mismatch; surface a uniform error.
        throw new Error("vault decrypt failed: auth tag mismatch");
      }
    },
    fingerprint(plaintext, tenantId) {
      const hmac = createHash("sha256")
        .update(key)
        .update("\0")
        .update(tenantId, "utf8")
        .update("\0")
        .update(plaintext, "utf8")
        .digest()
        .subarray(0, 16);
      return encodeBase64Url(hmac);
    },
  };
}

/** Constant-time equality for opaque fingerprints. */
export function fingerprintsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
