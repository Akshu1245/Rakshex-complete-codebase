import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  hashToken,
  generateSecureToken,
} from "./password";
import crypto from "crypto";

describe("password Argon2id", () => {
  it("hashes and verifies with argon2id", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(hash.startsWith("argon2id$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  }, 30_000);

  it("never stores plaintext", () => {
    const pw = "SuperSecret123!";
    const hash = hashPassword(pw);
    expect(hash).not.toContain(pw);
  });

  it("needsRehash is false for fresh argon2id", () => {
    const hash = hashPassword("x");
    expect(needsRehash(hash)).toBe(false);
  });

  it("verifies legacy pbkdf2 hashes", () => {
    // Build a PBKDF2 hash compatible with previous format
    const salt = crypto.randomBytes(32);
    const derived = crypto.pbkdf2Sync("legacy-pass", salt, 100000, 64, "sha512");
    const stored = `pbkdf2:sha512:${salt.toString("hex")}:${derived.toString("hex")}`;
    expect(verifyPassword("legacy-pass", stored)).toBe(true);
    expect(needsRehash(stored)).toBe(true);
  });

  it("hashToken is deterministic SHA-256", () => {
    const a = hashToken("abc");
    const b = hashToken("abc");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("generateSecureToken returns hex", () => {
    const t = generateSecureToken(16);
    expect(t).toMatch(/^[0-9a-f]{32}$/);
  });
});
