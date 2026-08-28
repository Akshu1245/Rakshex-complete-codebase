# Signed action receipts

Rakshex action receipts use a SHA-256 hash chain and Ed25519 signatures. The database table is append-only: PostgreSQL rejects `UPDATE` and `DELETE` on receipt rows.

## Signing configuration

The API requires both environment variables before a governed OpenAI request can cross the provider boundary:

- `RAKSHEX_RECEIPT_SIGNING_PRIVATE_KEY` — an Ed25519 PKCS#8 PEM private key. A PEM with literal `\n` separators is accepted.
- `RAKSHEX_RECEIPT_SIGNING_KEY_ID` — a stable rotation identifier such as `receipts-2026-08`.

If either value is absent or invalid, the gateway blocks before provider egress. Do not place the private key in customer application code or receipt exports.

## Rotation

1. Generate a new Ed25519 key pair outside the application runtime.
2. Distribute the new public key and key ID to auditors through the same trusted channel used for the previous public key.
3. Update both signing environment variables together.
4. Keep every retired public key in the auditor's trusted key ring for as long as receipts signed by it must remain verifiable.

Each ledger row records the signing key ID and public key used for that row, and the exported bundle is signed by the currently active key. The verifier still requires an independently trusted `keyId -> publicKeyPem` map; it does not trust a public key merely because the receipt contains it.

## Offline verification

Use `verifyReceiptBundle(bundle, trustedKeys)` for JSON exports or `verifyReceiptPdf(pdfBuffer, trustedKeys)` for PDF exports from `apps/api/services/receipts/actionReceipts.ts`.

Verification checks:

- the workspace chain starts at the fixed genesis hash;
- every `previousHash` points to the preceding entry;
- every SHA-256 entry hash recomputes exactly;
- every Ed25519 signature validates against a pinned trusted public key;
- the bundle signature and chain head validate;
- for PDF exports, every PDF byte must reproduce exactly from the embedded signed bundle.

A changed payload byte, signature, hash pointer, embedded key, PDF byte, or chain head causes verification to fail. Prompt/message/body fields are removed before receipt payloads are signed and persisted.
