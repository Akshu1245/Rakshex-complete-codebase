import crypto from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import { actionReceiptLedger, type ActionReceiptLedgerEntry } from "@rakshex/database";
import * as db from "../../db";

export const RECEIPT_VERSION = 1 as const;
export const GENESIS_HASH = "0".repeat(64);
export type ActionReceiptEventType = "allow" | "deny" | "kill" | "settle";
export type TrustedReceiptKeys = Record<string, string>;

export interface ReceiptSigner {
  keyId: string;
  privateKey: crypto.KeyObject;
  publicKeyPem: string;
}

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

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export function createReceiptSigner(privateKeyPem: string, keyId: string): ReceiptSigner {
  const normalizedId = keyId.trim();
  if (!/^[A-Za-z0-9._:/-]{1,128}$/.test(normalizedId)) {
    throw new Error("RAKSHEX_RECEIPT_SIGNING_KEY_ID is invalid");
  }
  const privateKey = crypto.createPrivateKey(normalizePem(privateKeyPem));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Rakshex receipt signing key must be Ed25519");
  }
  const publicKeyPem = crypto
    .createPublicKey(privateKey)
    .export({ type: "spki", format: "pem" })
    .toString();
  return { keyId: normalizedId, privateKey, publicKeyPem };
}

export function signerFromEnvironment(): ReceiptSigner {
  const privateKey = process.env.RAKSHEX_RECEIPT_SIGNING_PRIVATE_KEY?.trim();
  const keyId = process.env.RAKSHEX_RECEIPT_SIGNING_KEY_ID?.trim();
  if (!privateKey || !keyId) {
    throw new Error(
      "Receipt signing is not configured: RAKSHEX_RECEIPT_SIGNING_PRIVATE_KEY and RAKSHEX_RECEIPT_SIGNING_KEY_ID are required",
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

export function createSignedReceiptEntry(
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
): ReceiptEntryExport {
  const payload = sanitizeReceiptPayload(input.payload);
  const occurredAt = input.occurredAt.toISOString();
  const material = entryMaterial({ ...input, occurredAt, payload });
  const entryHash = sha256Hex(canonicalJson(material));
  const signature = crypto
    .sign(null, Buffer.from(entryHash, "hex"), signer.privateKey)
    .toString("base64");
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
    signature,
    publicKeyPem: signer.publicKeyPem,
  };
}

function verifyEntry(entry: ReceiptEntryExport, trustedKeys: TrustedReceiptKeys): string | null {
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
  const expectedHash = sha256Hex(canonicalJson(material));
  if (!/^[0-9a-f]{64}$/i.test(entry.entryHash)) {
    return "invalid entry hash encoding";
  }
  const expectedHashBytes = Buffer.from(expectedHash, "hex");
  const entryHashBytes = Buffer.from(entry.entryHash, "hex");
  if (
    entryHashBytes.length !== expectedHashBytes.length ||
    !crypto.timingSafeEqual(expectedHashBytes, entryHashBytes)
  ) {
    return "entry hash mismatch";
  }
  const publicKey = crypto.createPublicKey(normalizePem(trustedPem));
  const signatureOk = crypto.verify(
    null,
    Buffer.from(entry.entryHash, "hex"),
    publicKey,
    Buffer.from(entry.signature, "base64"),
  );
  return signatureOk ? null : "entry signature verification failed";
}

function bundleMaterial(bundle: Omit<ReceiptBundle, "bundleSignature">) {
  return bundle;
}

export function createSignedReceiptBundle(
  input: {
    workspaceId: number;
    exportedAt: Date;
    entries: ReceiptEntryExport[];
  },
  signer: ReceiptSigner,
): ReceiptBundle {
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
  const digest = sha256Hex(canonicalJson(bundleMaterial(unsigned)));
  const bundleSignature = crypto
    .sign(null, Buffer.from(digest, "hex"), signer.privateKey)
    .toString("base64");
  return { ...unsigned, bundleSignature };
}

export function verifyReceiptBundle(
  bundle: ReceiptBundle,
  trustedKeys: TrustedReceiptKeys,
): { valid: true } | { valid: false; error: string } {
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
    const entryError = verifyEntry(entry, trustedKeys);
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
  const digest = sha256Hex(canonicalJson(bundleMaterial(unsigned)));
  const signatureOk = crypto.verify(
    null,
    Buffer.from(digest, "hex"),
    crypto.createPublicKey(normalizePem(trustedPem)),
    Buffer.from(bundleSignature, "base64"),
  );
  return signatureOk
    ? { valid: true }
    : { valid: false, error: "bundle signature verification failed" };
}

function fromRow(row: ActionReceiptLedgerEntry): ReceiptEntryExport {
  return {
    version: RECEIPT_VERSION,
    id: row.id,
    workspaceId: row.workspaceId,
    requestId: row.requestId,
    eventType: row.eventType as ActionReceiptEventType,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload,
    previousHash: row.previousHash,
    entryHash: row.entryHash,
    signingKeyId: row.signingKeyId,
    signingAlgorithm: "ed25519",
    signature: row.signature,
    publicKeyPem: row.publicKeyPem,
  };
}

export async function appendActionReceipt(input: {
  workspaceId: number;
  requestId: string;
  eventType: ActionReceiptEventType;
  occurredAt?: Date;
  payload: Record<string, unknown>;
}): Promise<ReceiptEntryExport> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable — receipt append is fail-closed");
  const signer = signerFromEnvironment();
  const occurredAt = input.occurredAt ?? new Date();

  return database.transaction(async (tx) => {
    // Serialize one workspace chain without blocking unrelated workspaces.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.workspaceId}::bigint)`);
    const [previous] = await tx
      .select({ entryHash: actionReceiptLedger.entryHash })
      .from(actionReceiptLedger)
      .where(eq(actionReceiptLedger.workspaceId, input.workspaceId))
      .orderBy(desc(actionReceiptLedger.id))
      .limit(1);

    const signed = createSignedReceiptEntry(
      {
        workspaceId: input.workspaceId,
        requestId: input.requestId,
        eventType: input.eventType,
        occurredAt,
        payload: input.payload,
        previousHash: previous?.entryHash ?? GENESIS_HASH,
      },
      signer,
    );
    const [inserted] = await tx
      .insert(actionReceiptLedger)
      .values({
        workspaceId: signed.workspaceId,
        requestId: signed.requestId,
        eventType: signed.eventType,
        occurredAt,
        payload: signed.payload,
        previousHash: signed.previousHash,
        entryHash: signed.entryHash,
        signingKeyId: signed.signingKeyId,
        signingAlgorithm: signed.signingAlgorithm,
        signature: signed.signature,
        publicKeyPem: signed.publicKeyPem,
      })
      .returning();
    if (!inserted) throw new Error("Receipt ledger append returned no row");
    return fromRow(inserted);
  });
}

export async function exportReceiptBundle(input: {
  workspaceId: number;
  requestId?: string;
}): Promise<ReceiptBundle> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const rows = await database
    .select()
    .from(actionReceiptLedger)
    .where(eq(actionReceiptLedger.workspaceId, input.workspaceId))
    .orderBy(asc(actionReceiptLedger.id));
  let selected = rows;
  if (input.requestId) {
    const terminal = rows.findLastIndex((row) => row.requestId === input.requestId);
    if (terminal < 0) throw new Error("Receipt request id not found in workspace ledger");
    selected = rows.slice(0, terminal + 1);
  }
  return createSignedReceiptBundle(
    {
      workspaceId: input.workspaceId,
      exportedAt: new Date(),
      entries: selected.map(fromRow),
    },
    signerFromEnvironment(),
  );
}

export function receiptBundleJson(bundle: ReceiptBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderSignedReceiptPdf(bundle: ReceiptBundle): Buffer {
  const embedded = Buffer.from(receiptBundleJson(bundle), "utf8").toString("base64");
  const lines = [
    "Rakshex Signed Action Receipt",
    `Workspace: ${bundle.workspaceId}`,
    `Entries: ${bundle.entries.length}`,
    `Chain head: ${bundle.chainHead}`,
    `Signing key: ${bundle.bundleSigningKeyId}`,
    `Exported: ${bundle.exportedAt}`,
    "Verify the embedded signed JSON with a trusted Rakshex public-key ring.",
  ];
  const stream = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    ...lines
      .flatMap((line, index) => [index === 0 ? "" : "0 -22 Td", `(${pdfEscape(line)}) Tj`])
      .filter(Boolean),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = `%PDF-1.4\n%RAKSHEX_RECEIPT_BUNDLE_BASE64:${embedded}\n`;
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
}

export function verifyReceiptPdf(
  pdf: Buffer,
  trustedKeys: TrustedReceiptKeys,
): { valid: true; bundle: ReceiptBundle } | { valid: false; error: string } {
  const raw = pdf.toString("utf8");
  const marker = raw.match(/^%RAKSHEX_RECEIPT_BUNDLE_BASE64:([^\r\n]+)$/m)?.[1];
  if (!marker) return { valid: false, error: "signed receipt bundle marker missing" };
  let bundle: ReceiptBundle;
  try {
    bundle = JSON.parse(Buffer.from(marker, "base64").toString("utf8")) as ReceiptBundle;
  } catch {
    return { valid: false, error: "embedded receipt bundle is invalid" };
  }
  const verification = verifyReceiptBundle(bundle, trustedKeys);
  if (!verification.valid) return verification;
  const expected = renderSignedReceiptPdf(bundle);
  if (expected.length !== pdf.length || !crypto.timingSafeEqual(expected, pdf)) {
    return { valid: false, error: "PDF bytes do not match the signed receipt bundle" };
  }
  return { valid: true, bundle };
}
