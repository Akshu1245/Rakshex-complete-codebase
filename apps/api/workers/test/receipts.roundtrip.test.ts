/**
 * Receipt sign/verify roundtrip (WebCrypto Ed25519).
 * Key generated fresh per run with node:crypto — test-only; the worker itself
 * never touches node:crypto.
 */
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  createReceiptSigner,
  createSignedReceiptBundle,
  createSignedReceiptEntry,
  GENESIS_HASH,
  RECEIPT_VERSION,
  sanitizeReceiptPayload,
  verifyEntry,
  verifyReceiptBundle,
  type ReceiptEntryExport,
} from "../src/receipts";

function freshKey(): { b64: string; pem: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return { b64: der.toString("base64"), pem };
}

async function signedEntry(
  overrides: Partial<Parameters<typeof createSignedReceiptEntry>[0]> = {},
) {
  const { b64, pem } = freshKey();
  const signer = await createReceiptSigner(b64, "test-key-1");
  const entry = await createSignedReceiptEntry(
    {
      workspaceId: 7,
      requestId: "req-1",
      eventType: "deny",
      occurredAt: new Date("2026-09-25T10:00:00.000Z"),
      payload: { decision: "DENY", prompt: "must be stripped" },
      previousHash: GENESIS_HASH,
      ...overrides,
    },
    signer,
  );
  return { entry, pem, signer };
}

describe("receipt sign/verify roundtrip", () => {
  it("signs and verifies an entry; sanitization strips prompt-like keys", async () => {
    const { entry, pem } = await signedEntry();
    expect(entry.version).toBe(RECEIPT_VERSION);
    expect(entry.signingAlgorithm).toBe("ed25519");
    expect(entry.payload).not.toHaveProperty("prompt");
    expect(entry.publicKeyPem.trim()).toBe(pem.trim());
    const err = await verifyEntry(entry, { "test-key-1": pem });
    expect(err).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const { entry, pem } = await signedEntry();
    const tampered: ReceiptEntryExport = {
      ...entry,
      payload: { ...entry.payload, decision: "ALLOW" },
    };
    const err = await verifyEntry(tampered, { "test-key-1": pem });
    expect(err).toBe("entry hash mismatch");
  });

  it("rejects an untrusted signing key", async () => {
    const { entry, pem } = await signedEntry();
    const err = await verifyEntry(entry, { "other-key": pem });
    expect(err).toBe("untrusted signing key: test-key-1");
  });

  it("verifies a two-entry bundle with an intact hash chain", async () => {
    const { b64, pem } = freshKey();
    const signer = await createReceiptSigner(b64, "bundle-key");
    const e1 = await createSignedReceiptEntry(
      {
        id: 1,
        workspaceId: 7,
        requestId: "r1",
        eventType: "allow",
        occurredAt: new Date("2026-09-25T10:00:00.000Z"),
        payload: {},
        previousHash: GENESIS_HASH,
      },
      signer,
    );
    const e2 = await createSignedReceiptEntry(
      {
        id: 2,
        workspaceId: 7,
        requestId: "r2",
        eventType: "deny",
        occurredAt: new Date("2026-09-25T10:01:00.000Z"),
        payload: {},
        previousHash: e1.entryHash,
      },
      signer,
    );
    const bundle = await createSignedReceiptBundle(
      { workspaceId: 7, exportedAt: new Date("2026-09-25T10:02:00.000Z"), entries: [e1, e2] },
      signer,
    );
    expect(bundle.chainHead).toBe(e2.entryHash);
    const result = await verifyReceiptBundle(bundle, { "bundle-key": pem });
    expect(result).toEqual({ valid: true });
  });

  it("rejects a bundle with a broken hash chain", async () => {
    const { b64, pem } = freshKey();
    const signer = await createReceiptSigner(b64, "bundle-key");
    const e1 = await createSignedReceiptEntry(
      {
        id: 1,
        workspaceId: 7,
        requestId: "r1",
        eventType: "allow",
        occurredAt: new Date("2026-09-25T10:00:00.000Z"),
        payload: {},
        previousHash: GENESIS_HASH,
      },
      signer,
    );
    const e2 = await createSignedReceiptEntry(
      {
        id: 2,
        workspaceId: 7,
        requestId: "r2",
        eventType: "deny",
        occurredAt: new Date("2026-09-25T10:01:00.000Z"),
        payload: {},
        previousHash: "f".repeat(64), // forked — not e1.entryHash
      },
      signer,
    );
    const bundle = await createSignedReceiptBundle(
      { workspaceId: 7, exportedAt: new Date(), entries: [e1, e2] },
      signer,
    );
    const result = await verifyReceiptBundle(bundle, { "bundle-key": pem });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/hash chain mismatch/);
  });

  it("canonicalJson matches the Node implementation's key ordering", () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
    expect(sanitizeReceiptPayload({ PROMPT: "x", ok: 1 })).toEqual({ ok: 1 });
  });
});
