/**
 * Signed action receipts for Workers — WebCrypto port of
 * apps/api/services/receipts/actionReceipts.ts.
 *
 * Semantics kept IDENTICAL so receipts stay verifiable across targets:
 *   - same OMITTED_KEYS sanitization
 *   - same canonical-JSON (sorted keys) + SHA-256 hash-chain material
 *   - Ed25519 signatures over the raw 32-byte entry hash
 *   - same export/bundle shapes (ReceiptEntryExport / ReceiptBundle)
 *
 * Only the crypto plumbing changes: node:crypto → SubtleCrypto.
 */
export const RECEIPT_VERSION = 1 as const;
export const GENESIS_HASH = "0".repeat(64);

export type ActionReceiptEventType = "allow" | "deny" | "kill" | "settle";
export type TrustedReceiptKeys = Record<string, string>;

export interface ReceiptEntryExport {
  version: 1;
  id?: number;
  workspaceId: number;
  requestId: string;
  eventType: ActionReceiptEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  previousHash: string;
  entryHash: string;
  signingKeyId: string;
  signingAlgorithm: "ed25519";
  signature: string;
  publicKeyPem: string;
}

export interface ReceiptBundle {
  version: 1;
  workspaceId: number;
  exportedAt: string;
  throughEntryId: number | null;
  chainHead: string;
  entries: ReceiptEntryExport[];
  bundleSigningKeyId: string;
  bundleSigningAlgorithm: "ed25519";
  bundlePublicKeyPem: string;
  bundleSignature: string;
}

const OMITTED_KEYS = new Set([
  "prompt",
  "rawprompt",
  "messages",
  "content",
  "input",
  "requestbody",
  "responsebody",
  "body",
]);

function jsonSafe(value: unknown): unknown {
  if (value == null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (OMITTED_KEYS.has(key.toLowerCase())) continue;
      if (child === undefined || typeof child === "function" || typeof child === "symbol") continue;
      output[key] = jsonSafe(child);
    }
    return output;
  }
  return String(value);
}

export function sanitizeReceiptPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return jsonSafe(payload) as Record<string, unknown>;
}

export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input == null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(normalize);
    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      output[key] = normalize(record[key]);
    }
    return output;
  };
  return JSON.stringify(normalize(jsonSafe(value)));
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "");
  return b64ToBytes(body);
}

function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function derToPem(der: ArrayBuffer, label: string): string {
  const b64 = bytesToB64(new Uint8Array(der));
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export interface ReceiptSigner {
  keyId: string;
  privateKey: CryptoKey;
  publicKeyPem: string;
}

const KEY_ID_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

/** Accepts base64 PKCS8 DER or a PEM block (env secrets arrive either way). */
export async function createReceiptSigner(
  privateKeyMaterial: string,
  keyId: string,
): Promise<ReceiptSigner> {
  const normalizedId = keyId.trim();
  if (!KEY_ID_RE.test(normalizedId)) throw new Error("RECEIPT_SIGNING_KEY_ID is invalid");
  const trimmed = privateKeyMaterial.trim();
  const der = trimmed.startsWith("-----") ? pemToDer(normalizePem(trimmed)) : b64ToBytes(trimmed);
  let extractable: CryptoKey;
  try {
    extractable = await crypto.subtle.importKey(
      "pkcs8",
      der.buffer as ArrayBuffer,
      { name: "Ed25519" },
      true,
      ["sign"],
    );
  } catch {
    throw new Error("Receipt signing key must be an Ed25519 PKCS8 key");
  }
  const privateKey: CryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const spki = await crypto.subtle.exportKey("spki", extractable).catch(async () => {
    // Some runtimes refuse SPKI export from a sign-only Ed25519 key; fall back to
    // deriving via JWK.
    const jwk = (await crypto.subtle.exportKey("jwk", extractable)) as JsonWebKey & { x?: string };
    if (!jwk.x) throw new Error("Cannot derive Ed25519 public key from signing key");
    const raw = b64ToBytes(jwk.x.replace(/-/g, "+").replace(/_/g, "/"));
    const prefixed = new Uint8Array(44);
    // SPKI prefix for Ed25519: 302a300506032b6570032100
    const prefix = hexToBytes("302a300506032b6570032100");
    prefixed.set(prefix);
    prefixed.set(raw, prefix.length);
    return prefixed.buffer as ArrayBuffer;
  });
  return { keyId: normalizedId, privateKey, publicKeyPem: derToPem(spki, "PUBLIC KEY") };
}

export function signerFromEnvironment(env: {
  RECEIPT_SIGNING_PRIVATE_KEY?: string;
  RECEIPT_SIGNING_KEY_ID?: string;
}): Promise<ReceiptSigner> {
  const privateKey = env.RECEIPT_SIGNING_PRIVATE_KEY?.trim();
  const keyId = env.RECEIPT_SIGNING_KEY_ID?.trim();
  if (!privateKey || !keyId) {
    throw new Error(
      "Receipt signing is not configured: RECEIPT_SIGNING_PRIVATE_KEY and RECEIPT_SIGNING_KEY_ID are required",
    );
  }
  return createReceiptSigner(privateKey, keyId);
}

function entryMaterial(input: {
  workspaceId: number;
  requestId: string;
  eventType: ActionReceiptEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  previousHash: string;
}) {
  return {
    version: RECEIPT_VERSION,
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    payload: input.payload,
    previousHash: input.previousHash,
  };
}

export async function createSignedReceiptEntry(
  input: {
    id?: number;
    workspaceId: number;
    requestId: string;
    eventType: ActionReceiptEventType;
    occurredAt: Date;
    payload: Record<string, unknown>;
    previousHash: string;
  },
  signer: ReceiptSigner,
): Promise<ReceiptEntryExport> {
  const payload = sanitizeReceiptPayload(input.payload);
  const occurredAt = input.occurredAt.toISOString();
  const material = entryMaterial({ ...input, occurredAt, payload });
  const entryHash = await sha256Hex(canonicalJson(material));
  const signatureBytes = await crypto.subtle.sign(
    { name: "Ed25519" },
    signer.privateKey,
    hexToBytes(entryHash).buffer as ArrayBuffer,
  );
  return {
    version: RECEIPT_VERSION,
    ...(input.id == null ? {} : { id: input.id }),
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    eventType: input.eventType,
    occurredAt,
    payload,
    previousHash: input.previousHash,
    entryHash,
    signingKeyId: signer.keyId,
    signingAlgorithm: "ed25519",
    signature: bytesToB64(new Uint8Array(signatureBytes)),
    publicKeyPem: signer.publicKeyPem,
  };
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function importVerifyKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(normalizePem(pem));
  return crypto.subtle.importKey("spki", der.buffer as ArrayBuffer, { name: "Ed25519" }, false, [
    "verify",
  ]);
}

export async function verifyEntry(
  entry: ReceiptEntryExport,
  trustedKeys: TrustedReceiptKeys,
): Promise<string | null> {
  if (entry.version !== RECEIPT_VERSION || entry.signingAlgorithm !== "ed25519") {
    return "unsupported receipt version or signing algorithm";
  }
  const trustedPem = trustedKeys[entry.signingKeyId];
  if (!trustedPem) return `untrusted signing key: ${entry.signingKeyId}`;
  if (normalizePem(trustedPem).trim() !== entry.publicKeyPem.trim()) {
    return `public key mismatch for signing key: ${entry.signingKeyId}`;
  }
  const material = entryMaterial({
    workspaceId: entry.workspaceId,
    requestId: entry.requestId,
    eventType: entry.eventType,
    occurredAt: entry.occurredAt,
    payload: entry.payload,
    previousHash: entry.previousHash,
  });
  const expectedHash = await sha256Hex(canonicalJson(material));
  if (!/^[0-9a-f]{64}$/i.test(entry.entryHash)) return "invalid entry hash encoding";
  if (!constantTimeHexEqual(entry.entryHash.toLowerCase(), expectedHash)) {
    return "entry hash mismatch";
  }
  let publicKey: CryptoKey;
  try {
    publicKey = await importVerifyKey(trustedPem);
  } catch {
    return "invalid trusted public key encoding";
  }
  const signatureOk = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    b64ToBytes(entry.signature).buffer as ArrayBuffer,
    hexToBytes(entry.entryHash).buffer as ArrayBuffer,
  );
  return signatureOk ? null : "entry signature verification failed";
}

export async function createSignedReceiptBundle(
  input: { workspaceId: number; exportedAt: Date; entries: ReceiptEntryExport[] },
  signer: ReceiptSigner,
): Promise<ReceiptBundle> {
  const chainHead = input.entries.at(-1)?.entryHash ?? GENESIS_HASH;
  const throughEntryId = input.entries.at(-1)?.id ?? null;
  const unsigned: Omit<ReceiptBundle, "bundleSignature"> = {
    version: RECEIPT_VERSION,
    workspaceId: input.workspaceId,
    exportedAt: input.exportedAt.toISOString(),
    throughEntryId,
    chainHead,
    entries: input.entries,
    bundleSigningKeyId: signer.keyId,
    bundleSigningAlgorithm: "ed25519",
    bundlePublicKeyPem: signer.publicKeyPem,
  };
  const digest = await sha256Hex(canonicalJson(unsigned));
  const signatureBytes = await crypto.subtle.sign(
    { name: "Ed25519" },
    signer.privateKey,
    hexToBytes(digest).buffer as ArrayBuffer,
  );
  return { ...unsigned, bundleSignature: bytesToB64(new Uint8Array(signatureBytes)) };
}

export async function verifyReceiptBundle(
  bundle: ReceiptBundle,
  trustedKeys: TrustedReceiptKeys,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (bundle.version !== RECEIPT_VERSION || bundle.bundleSigningAlgorithm !== "ed25519") {
    return { valid: false, error: "unsupported receipt bundle version or signing algorithm" };
  }
  let previousHash = GENESIS_HASH;
  for (const [index, entry] of bundle.entries.entries()) {
    if (entry.workspaceId !== bundle.workspaceId) {
      return { valid: false, error: `workspace mismatch at entry ${index}` };
    }
    if (entry.previousHash !== previousHash) {
      return { valid: false, error: `hash chain mismatch at entry ${index}` };
    }
    const entryError = await verifyEntry(entry, trustedKeys);
    if (entryError) return { valid: false, error: `${entryError} at entry ${index}` };
    previousHash = entry.entryHash;
  }
  const expectedHead = bundle.entries.at(-1)?.entryHash ?? GENESIS_HASH;
  if (bundle.chainHead !== expectedHead)
    return { valid: false, error: "bundle chain head mismatch" };
  if ((bundle.entries.at(-1)?.id ?? null) !== bundle.throughEntryId) {
    return { valid: false, error: "bundle terminal entry id mismatch" };
  }
  const trustedPem = trustedKeys[bundle.bundleSigningKeyId];
  if (!trustedPem)
    return { valid: false, error: `untrusted bundle key: ${bundle.bundleSigningKeyId}` };
  if (normalizePem(trustedPem).trim() !== bundle.bundlePublicKeyPem.trim()) {
    return { valid: false, error: "bundle public key mismatch" };
  }
  const { bundleSignature, ...unsigned } = bundle;
  const digest = await sha256Hex(canonicalJson(unsigned));
  let publicKey: CryptoKey;
  try {
    publicKey = await importVerifyKey(trustedPem);
  } catch {
    return { valid: false, error: "invalid trusted bundle public key encoding" };
  }
  const signatureOk = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    b64ToBytes(bundleSignature).buffer as ArrayBuffer,
    hexToBytes(digest).buffer as ArrayBuffer,
  );
  return signatureOk
    ? { valid: true }
    : { valid: false, error: "bundle signature verification failed" };
}

export function receiptBundleJson(bundle: ReceiptBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/**
 * Printable-HTML receipt render (replaces the Node pdfkit/hand-rolled PDF path).
 * The JSON bundle remains the canonical verifiable artifact; this HTML is the
 * human-readable twin stored to R2 by the queue consumer.
 */
export function renderReceiptHtml(bundle: ReceiptBundle): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = bundle.entries
    .map(
      (e) =>
        `<tr><td>${e.id ?? ""}</td><td>${esc(e.eventType)}</td><td>${esc(e.occurredAt)}</td><td><code>${esc(e.entryHash.slice(0, 16))}…</code></td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>RaksHex Signed Action Receipt</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}code{font-size:.85em}</style></head><body><h1>RaksHex Signed Action Receipt</h1><dl><dt>Workspace</dt><dd>${bundle.workspaceId}</dd><dt>Entries</dt><dd>${bundle.entries.length}</dd><dt>Chain head</dt><dd><code>${esc(bundle.chainHead)}</code></dd><dt>Signing key</dt><dd><code>${esc(bundle.bundleSigningKeyId)}</code> (ed25519)</dd><dt>Exported</dt><dd>${esc(bundle.exportedAt)}</dd></dl><table><thead><tr><th>ID</th><th>Event</th><th>Occurred</th><th>Entry hash</th></tr></thead><tbody>${rows}</tbody></table><p>Verify the signed JSON bundle with a trusted RaksHex public-key ring.</p></body></html>`;
}
