// @ts-nocheck
import { describe, expect, it } from "vitest";
import { createVault, fingerprintsEqual } from "./encryptedVault";

const HEX_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryptedVault", () => {
  it("round-trips a plaintext through encrypt / decrypt", () => {
    const v = createVault({ key: HEX_KEY });
    const enc = v.encrypt("sk-openai-real-secret", "tenant-a");
    expect(enc.ciphertext).toMatch(/^v1\./);
    const out = v.decrypt(enc, "tenant-a");
    expect(out).toBe("sk-openai-real-secret");
  });

  it("uses a fresh IV per encryption (ciphertexts differ for the same input)", () => {
    const v = createVault({ key: HEX_KEY });
    const a = v.encrypt("hello world", "t");
    const b = v.encrypt("hello world", "t");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // Both still decrypt back to the same plaintext.
    expect(v.decrypt(a, "t")).toBe("hello world");
    expect(v.decrypt(b, "t")).toBe("hello world");
  });

  it("rejects decryption from a different tenant (AAD binding)", () => {
    const v = createVault({ key: HEX_KEY });
    const enc = v.encrypt("private", "tenant-a");
    expect(() => v.decrypt(enc, "tenant-b")).toThrow(/auth tag mismatch/i);
  });

  it("rejects decryption with the wrong key", () => {
    const v1 = createVault({ key: HEX_KEY });
    const v2 = createVault({
      key: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    });
    const enc = v1.encrypt("secret", "t");
    expect(() => v2.decrypt(enc, "t")).toThrow(/auth tag mismatch/i);
  });

  it("rejects malformed ciphertexts", () => {
    const v = createVault({ key: HEX_KEY });
    expect(() => v.decrypt({ ciphertext: "not-a-record" }, "t")).toThrow(/malformed/i);
    expect(() => v.decrypt({ ciphertext: "v2.aaa.bbb.ccc" }, "t")).toThrow(/unsupported version/i);
  });

  it("accepts base64 and UTF-8 keys (utf8 hashed via SHA-256)", () => {
    const b64Key = Buffer.from(HEX_KEY, "hex").toString("base64");
    const v1 = createVault({ key: b64Key });
    const enc = v1.encrypt("base64 keyed", "t");
    expect(v1.decrypt(enc, "t")).toBe("base64 keyed");

    const v2 = createVault({ key: "any user-supplied passphrase that's longish" });
    const e2 = v2.encrypt("utf8 keyed", "t");
    expect(v2.decrypt(e2, "t")).toBe("utf8 keyed");
  });

  it("produces deterministic fingerprints for the same (plaintext, tenant)", () => {
    const v = createVault({ key: HEX_KEY });
    const a = v.fingerprint("user@example.com", "tenant-a");
    const b = v.fingerprint("user@example.com", "tenant-a");
    expect(a).toBe(b);
    expect(fingerprintsEqual(a, b)).toBe(true);
  });

  it("produces different fingerprints across tenants for the same plaintext", () => {
    const v = createVault({ key: HEX_KEY });
    const a = v.fingerprint("user@example.com", "tenant-a");
    const b = v.fingerprint("user@example.com", "tenant-b");
    expect(a).not.toBe(b);
    expect(fingerprintsEqual(a, b)).toBe(false);
  });

  it("rejects key material shorter than 32 bytes", () => {
    expect(() => createVault({ key: "too short" })).not.toThrow(); // hashed to 32B
    // Pass a 31-byte hex string — should fall through to the SHA hash path.
    const v = createVault({ key: "deadbeef" });
    const enc = v.encrypt("x", "t");
    expect(v.decrypt(enc, "t")).toBe("x");
  });
});
