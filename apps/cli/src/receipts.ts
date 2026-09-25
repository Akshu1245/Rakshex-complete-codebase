/**
 * Local receipt scheme for `rakshex demo` / `rakshex verify`.
 *
 * Mirrors the canonical scheme in `apps/api/services/receipts/actionReceipts.ts`:
 * canonical JSON (sorted keys) → SHA-256 → Ed25519, hash-chained entries,
 * signed bundles. Kept stdlib-only so the published CLI gains no new
 * dependencies. Demo receipts are NOT server receipts — every demo payload
 * carries `demoMode: true` and the CLI prints that on every run.
 */
import crypto from "node:crypto";

export const RECEIPT_VERSION = 1 as const;
export const GENESIS_HASH = "0".repeat(64);

export interface ReceiptKeypair {
  keyId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface ReceiptEntry {
  version: number;
  workspaceId: string;
  requestId: string;
  eventType: string;
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
  version: number;
  workspaceId: string;
  entries: ReceiptEntry[];
  chainHead: string;
  throughEntryId: number;
  bundleSigningKeyId: string;
  bundleSigningAlgorithm: "ed25519";
  bundleSignature: string;
  publicKeyPem: string;
}

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input == null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(normalize);
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = normalize(record[key]);
    return out;
  };
  return JSON.stringify(normalize(jsonSafe(value)));
}

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateReceiptKeypair(keyId = "demo-receipt-key-1"): ReceiptKeypair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return { keyId, privateKeyPem, publicKeyPem };
}

function entryMaterial(input: {
  workspaceId: string;
  requestId: string;
  eventType: string;
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

export function signEntry(
  input: {
    workspaceId: string;
    requestId: string;
    eventType: string;
    payload: Record<string, unknown>;
    previousHash: string;
  },
  keypair: ReceiptKeypair,
): ReceiptEntry {
  const occurredAt = new Date().toISOString();
  const material = entryMaterial({ ...input, occurredAt });
  const entryHash = sha256Hex(canonicalJson(material));
  const signature = crypto
    .sign(null, Buffer.from(entryHash, "hex"), keypair.privateKeyPem)
    .toString("base64");
  return {
    version: RECEIPT_VERSION,
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    eventType: input.eventType,
    occurredAt,
    payload: input.payload,
    previousHash: input.previousHash,
    entryHash,
    signingKeyId: keypair.keyId,
    signingAlgorithm: "ed25519",
    signature,
    publicKeyPem: keypair.publicKeyPem,
  };
}

function verifyEntrySignature(entry: ReceiptEntry): string | null {
  if (entry.version !== RECEIPT_VERSION || entry.signingAlgorithm !== "ed25519") {
    return "unsupported receipt version or signing algorithm";
  }
  const material = entryMaterial({
    workspaceId: entry.workspaceId,
    requestId: entry.requestId,
    eventType: entry.eventType,
    occurredAt: entry.occurredAt,
    payload: entry.payload,
    previousHash: entry.previousHash,
  });
  const recomputed = sha256Hex(canonicalJson(material));
  if (recomputed !== entry.entryHash) return "entry hash mismatch — payload tampered";
  const ok = crypto.verify(
    null,
    Buffer.from(entry.entryHash, "hex"),
    entry.publicKeyPem,
    Buffer.from(entry.signature, "base64"),
  );
  return ok ? null : "Ed25519 signature invalid";
}

export function createBundle(
  workspaceId: string,
  entries: ReceiptEntry[],
  keypair: ReceiptKeypair,
): ReceiptBundle {
  const chainHead = entries.at(-1)?.entryHash ?? GENESIS_HASH;
  const material = { version: RECEIPT_VERSION, workspaceId, chainHead, throughEntryId: entries.length };
  const bundleHash = sha256Hex(canonicalJson(material));
  const bundleSignature = crypto
    .sign(null, Buffer.from(bundleHash, "hex"), keypair.privateKeyPem)
    .toString("base64");
  return {
    version: RECEIPT_VERSION,
    workspaceId,
    entries,
    chainHead,
    throughEntryId: entries.length,
    bundleSigningKeyId: keypair.keyId,
    bundleSigningAlgorithm: "ed25519",
    bundleSignature,
    publicKeyPem: keypair.publicKeyPem,
  };
}

/** Offline verification: hash chain + every Ed25519 signature + bundle signature. */
export function verifyBundle(bundle: ReceiptBundle): { valid: true } | { valid: false; error: string } {
  if (bundle.version !== RECEIPT_VERSION || bundle.bundleSigningAlgorithm !== "ed25519") {
    return { valid: false, error: "unsupported receipt bundle version or signing algorithm" };
  }
  let previousHash = GENESIS_HASH;
  for (const [index, entry] of bundle.entries.entries()) {
    if (entry.workspaceId !== bundle.workspaceId) {
      return { valid: false, error: `workspace mismatch at entry ${index}` };
    }
    if (entry.previousHash !== previousHash) {
      return { valid: false, error: `hash chain broken at entry ${index}` };
    }
    const entryError = verifyEntrySignature(entry);
    if (entryError) return { valid: false, error: `${entryError} at entry ${index}` };
    previousHash = entry.entryHash;
  }
  const expectedHead = bundle.entries.at(-1)?.entryHash ?? GENESIS_HASH;
  if (bundle.chainHead !== expectedHead) return { valid: false, error: "bundle chain head mismatch" };
  if (bundle.throughEntryId !== bundle.entries.length) {
    return { valid: false, error: "bundle terminal entry id mismatch" };
  }
  const bundleHash = sha256Hex(
    canonicalJson({
      version: bundle.version,
      workspaceId: bundle.workspaceId,
      chainHead: bundle.chainHead,
      throughEntryId: bundle.throughEntryId,
    }),
  );
  const ok = crypto.verify(
    null,
    Buffer.from(bundleHash, "hex"),
    bundle.publicKeyPem,
    Buffer.from(bundle.bundleSignature, "base64"),
  );
  return ok ? { valid: true } : { valid: false, error: "bundle signature invalid" };
}
