import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  createReceiptSigner,
  createSignedReceiptBundle,
  createSignedReceiptEntry,
  receiptBundleJson,
  renderSignedReceiptPdf,
  verifyReceiptBundle,
  verifyReceiptPdf,
  type ReceiptBundle,
} from "./actionReceipts";

function fixtureSigner() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    signer: createReceiptSigner(privatePem, "fixture-key-2026-08"),
    trustedKeys: { "fixture-key-2026-08": publicPem },
  };
}

function fixtureBundle() {
  const { signer, trustedKeys } = fixtureSigner();
  const allow = createSignedReceiptEntry(
    {
      id: 1,
      workspaceId: 42,
      requestId: "req_fixture_1",
      eventType: "allow",
      occurredAt: new Date("2026-08-28T01:00:00Z"),
      payload: {
        provider: "openai",
        model: "gpt-5-mini",
        estimatedCostUsd: 0.01,
        prompt: "must never be stored",
      },
      previousHash: GENESIS_HASH,
    },
    signer,
  );
  const settle = createSignedReceiptEntry(
    {
      id: 2,
      workspaceId: 42,
      requestId: "req_fixture_1",
      eventType: "settle",
      occurredAt: new Date("2026-08-28T01:00:01Z"),
      payload: {
        providerAccountId: 8,
        inputTokens: 20,
        outputTokens: 5,
        cachedInputTokens: 10,
        settledCostUsd: 0.00002,
      },
      previousHash: allow.entryHash,
    },
    signer,
  );
  const bundle = createSignedReceiptBundle(
    {
      workspaceId: 42,
      exportedAt: new Date("2026-08-28T01:05:00Z"),
      entries: [allow, settle],
    },
    signer,
  );
  return { bundle, trustedKeys };
}

describe("signed action receipts", () => {
  it("verifies an intact hash chain and signatures without database access", () => {
    const { bundle, trustedKeys } = fixtureBundle();
    expect(bundle.entries[0]?.payload).not.toHaveProperty("prompt");
    expect(verifyReceiptBundle(bundle, trustedKeys)).toEqual({ valid: true });
  });

  it("fails when one byte of exported JSON evidence is tampered", () => {
    const { bundle, trustedKeys } = fixtureBundle();
    const raw = receiptBundleJson(bundle);
    const tampered = raw.replace('"inputTokens": 20', '"inputTokens": 21');
    expect(tampered).not.toBe(raw);
    const parsed = JSON.parse(tampered) as ReceiptBundle;
    expect(verifyReceiptBundle(parsed, trustedKeys)).toMatchObject({ valid: false });
  });

  it("rejects a validly-shaped receipt signed by an untrusted replacement key", () => {
    const { bundle } = fixtureBundle();
    const attacker = fixtureSigner();
    expect(verifyReceiptBundle(bundle, attacker.trustedKeys)).toMatchObject({ valid: false });
  });

  it("exports a signed PDF that verifies offline and rejects a one-byte PDF mutation", () => {
    const { bundle, trustedKeys } = fixtureBundle();
    const pdf = renderSignedReceiptPdf(bundle);
    expect(verifyReceiptPdf(pdf, trustedKeys)).toMatchObject({ valid: true });

    const tampered = Buffer.from(pdf);
    const needle = Buffer.from("Rakshex Signed Action Receipt", "utf8");
    const offset = tampered.indexOf(needle);
    expect(offset).toBeGreaterThan(0);
    tampered[offset] = tampered[offset]! ^ 1;
    expect(verifyReceiptPdf(tampered, trustedKeys)).toMatchObject({ valid: false });
  });
});
