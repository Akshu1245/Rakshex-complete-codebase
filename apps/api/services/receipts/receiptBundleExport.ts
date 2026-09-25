/**
 * Auditor-facing receipt bundle export.
 *
 * Assembles a single downloadable ZIP containing:
 *   - bundle.json       — the Ed25519-signed receipt bundle (see actionReceipts.ts)
 *   - receipts.json     — the same signed entries as a plain array
 *   - index.csv         — one row per receipt, built with services/dataExport.ts
 *   - public-keys.json  — pinned signing public keys (key id → PEM)
 *   - README.txt        — plain-English offline verification guide
 *   - verify.sh / verify.mjs — offline verifier (Node.js 18+, stdlib only)
 *
 * The ZIP writer is stdlib-only (no new dependencies): store-only entries
 * with CRC-32, UTF-8 names, and unix mode bits so verify.sh stays executable.
 */
import { createHash } from "node:crypto";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { actionReceiptLedger } from "@rakshex/database";
import * as db from "../../db";
import { buildExport } from "../dataExport";
import {
  createSignedReceiptBundle,
  receiptBundleJson,
  signerFromEnvironment,
  type ReceiptBundle,
  type ReceiptEntryExport,
  type TrustedReceiptKeys,
} from "./actionReceipts";

export const MAX_RECEIPT_EXPORT = 5000;

export type ReceiptExportSelector =
  | { kind: "ids"; receiptIds: number[] }
  | { kind: "action"; actionId: string }
  | { kind: "range"; from: string; to: string };

/* ─── Minimal ZIP writer (store method, no compression) ─────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((Math.floor(date.getSeconds() / 2) & 0x1f) << 0),
    date:
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

export interface ZipFileEntry {
  name: string;
  data: Buffer;
  /** Unix file mode, e.g. 0o644. Defaults to 0o644. */
  mode?: number;
}

/** Build a store-only ZIP. Deterministic for identical inputs except timestamps. */
export function buildZip(files: ZipFileEntry[], modifiedAt: Date = new Date()): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosDateTime(modifiedAt);

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18); // compressed size
    local.writeUInt32LE(file.data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    const mode = file.mode ?? 0o644;
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // central directory signature
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8); // UTF-8 names
    cd.writeUInt16LE(0, 10); // method: store
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(file.data.length, 20);
    cd.writeUInt32LE(file.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra length
    cd.writeUInt16LE(0, 32); // comment length
    cd.writeUInt16LE(0, 34); // disk number
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE((mode & 0xffff) << 16, 38); // external attrs (unix mode)
    cd.writeUInt32LE(offset, 42); // local header offset

    chunks.push(local, nameBuf, file.data);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + file.data.length;
  }

  const centralStart = offset;
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const count = files.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // cd start disk
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...chunks, ...central, eocd]);
}

/* ─── Entry selection ───────────────────────────────────────────────────── */

function rowToEntry(row: typeof actionReceiptLedger.$inferSelect): ReceiptEntryExport {
  return {
    version: 1,
    id: row.id,
    workspaceId: row.workspaceId,
    requestId: row.requestId,
    eventType: row.eventType as ReceiptEntryExport["eventType"],
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

export async function fetchReceiptEntries(
  workspaceId: number,
  selector: ReceiptExportSelector,
): Promise<ReceiptEntryExport[]> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable — receipt export is fail-closed");

  let rows: (typeof actionReceiptLedger.$inferSelect)[];
  if (selector.kind === "ids") {
    rows = await database
      .select()
      .from(actionReceiptLedger)
      .where(
        and(
          eq(actionReceiptLedger.workspaceId, workspaceId),
          inArray(actionReceiptLedger.id, selector.receiptIds),
        ),
      )
      .orderBy(asc(actionReceiptLedger.id));
  } else if (selector.kind === "action") {
    // Chain-prefix semantics: all entries up to and including the last one
    // for this request id, so the exported chain is verifiable from genesis.
    const all = await database
      .select()
      .from(actionReceiptLedger)
      .where(eq(actionReceiptLedger.workspaceId, workspaceId))
      .orderBy(asc(actionReceiptLedger.id));
    let terminal = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i]!.requestId === selector.actionId) {
        terminal = i;
        break;
      }
    }
    if (terminal < 0) throw new Error("Receipt request id not found in workspace ledger");
    rows = all.slice(0, terminal + 1);
  } else {
    rows = await database
      .select()
      .from(actionReceiptLedger)
      .where(
        and(
          eq(actionReceiptLedger.workspaceId, workspaceId),
          gte(actionReceiptLedger.occurredAt, new Date(selector.from)),
          lte(actionReceiptLedger.occurredAt, new Date(selector.to)),
        ),
      )
      .orderBy(asc(actionReceiptLedger.id));
  }

  if (rows.length === 0) throw new Error("No receipts match the requested selector");
  if (rows.length > MAX_RECEIPT_EXPORT) {
    throw new Error(`Export exceeds ${MAX_RECEIPT_EXPORT} receipt limit — narrow the selector`);
  }
  return rows.map(rowToEntry);
}

/* ─── Bundle assembly ───────────────────────────────────────────────────── */

export function buildReceiptBundle(entries: ReceiptEntryExport[], workspaceId: number): ReceiptBundle {
  return createSignedReceiptBundle(
    { workspaceId, exportedAt: new Date(), entries },
    signerFromEnvironment(),
  );
}

export function trustedKeysFromBundle(bundle: ReceiptBundle): TrustedReceiptKeys {
  const keys: TrustedReceiptKeys = {};
  for (const entry of bundle.entries) {
    keys[entry.signingKeyId] = entry.publicKeyPem;
  }
  keys[bundle.bundleSigningKeyId] = bundle.bundlePublicKeyPem;
  return keys;
}

function readmeText(input: {
  workspaceId: number;
  exportedBy: string;
  exportedAt: string;
  entryCount: number;
  chainHead: string;
}): string {
  return `RAKSHEX SIGNED ACTION RECEIPTS — VERIFICATION GUIDE
=================================================

What this bundle proves
-----------------------
This bundle contains signed, tamper-evident records ("action receipts") of
AI-agent actions that RaksHex evaluated. Each receipt is:

  1. Hash-chained — every receipt carries the SHA-256 hash of the one
     before it, so a receipt cannot be inserted, removed, or reordered
     without breaking the chain.
  2. Digitally signed — the hash of each receipt is signed with an Ed25519
     private key held by RaksHex. The matching public keys are pinned in
     public-keys.json, so you can confirm each receipt came from us and has
     not been altered since.

Files in this bundle
--------------------
  bundle.json       The signed bundle: all receipts, the chain head, and the
                    bundle-level Ed25519 signature over the whole set.
  receipts.json     The same signed receipts as a plain array (convenience).
  index.csv         One line per receipt, for spreadsheets.
  public-keys.json  The public keys we signed with, listed by key id.
  verify.sh         Offline verifier. Needs only Node.js 18 or newer.
  verify.mjs        The verifier itself. No network, no npm install.

How to verify this proof offline (3 steps)
------------------------------------------
  1. Unzip this bundle into any folder.
  2. Run:  ./verify.sh
     (Equivalent: node verify.mjs. Works on macOS, Linux, and Windows.)
  3. Read the verdict. "ALL CHECKS PASSED" means:
       - every receipt's content hashes to its recorded entryHash,
       - every receipt links to the previous one, unbroken from genesis,
       - every Ed25519 signature verifies against the pinned public key,
       - the bundle-level signature over the whole set verifies.

Checking by hand instead
------------------------
  1. For any receipt, rebuild its content hash: take the canonical JSON of
     {version, workspaceId, requestId, eventType, occurredAt, payload,
     previousHash} with object keys sorted recursively, then SHA-256.
     It must equal the receipt's entryHash.
  2. Walk previousHash from the first receipt (which points at 64 zeros)
     through to the last. The final hash must equal bundle.json's
     chainHead.
  3. Verify one signature with OpenSSL. Convert the hex entryHash to raw
     bytes (32 bytes), then:
       openssl pkeyutl -verify -pubin -inkey public-key.pem \\
         -sigfile signature.bin -in hash.bin -rawin
     where public-key.pem holds the PEM from public-keys.json and
     signature.bin holds the base64-decoded signature. OpenSSL must print
     "Signature Verified".

Notes
-----
  - Receipt payloads intentionally omit prompts and message bodies. They
    record what was decided, when, and under which policy — not content.
  - Exported ${input.exportedAt} by ${input.exportedBy} for workspace ${input.workspaceId}.
    ${input.entryCount} receipts, chain head ${input.chainHead}.
  - RaksHex is in private beta. These receipts are evidence of what the
    control plane recorded; they are not a compliance certification.
`;
}

const VERIFY_MJS = `#!/usr/bin/env node
// Offline verifier for a RaksHex signed action-receipt bundle.
// Usage: node verify.mjs [bundle-dir]
// Requires: Node.js 18+. Standard library only — no network, no install.
import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2] || dirname(fileURLToPath(import.meta.url));
const GENESIS = "0".repeat(64);

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}
const canonicalJson = (v) => JSON.stringify(canonicalize(v));
const sha256Hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");

let bundle;
let trusted;
try {
  bundle = JSON.parse(readFileSync(join(dir, "bundle.json"), "utf8"));
  trusted = JSON.parse(readFileSync(join(dir, "public-keys.json"), "utf8")).keys;
} catch (err) {
  console.error("FAIL: could not read bundle.json / public-keys.json:", err.message);
  process.exit(2);
}

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error("FAIL:", msg);
};

if (bundle.version !== 1 || bundle.bundleSigningAlgorithm !== "ed25519") {
  fail("unsupported bundle version or signing algorithm");
}

let prev = GENESIS;
for (const [index, entry] of bundle.entries.entries()) {
  if (entry.previousHash !== prev) {
    fail("entry " + index + ": chain break (expected previousHash " + prev + ")");
  }
  const material = {
    version: entry.version,
    workspaceId: entry.workspaceId,
    requestId: entry.requestId,
    eventType: entry.eventType,
    occurredAt: entry.occurredAt,
    payload: entry.payload,
    previousHash: entry.previousHash,
  };
  const recomputed = sha256Hex(canonicalJson(material));
  if (
    !/^[0-9a-f]{64}$/i.test(entry.entryHash) ||
    !timingSafeEqual(Buffer.from(recomputed, "hex"), Buffer.from(entry.entryHash, "hex"))
  ) {
    fail("entry " + index + ": entryHash mismatch");
  }
  const pem = trusted[entry.signingKeyId];
  if (!pem) {
    fail("entry " + index + ": untrusted signing key " + entry.signingKeyId);
  } else {
    const ok = verify(
      null,
      Buffer.from(entry.entryHash, "hex"),
      createPublicKey(pem),
      Buffer.from(entry.signature, "base64"),
    );
    if (!ok) fail("entry " + index + ": signature invalid");
  }
  prev = entry.entryHash;
}

if (bundle.chainHead !== prev) fail("chain head mismatch");
const bundlePem = trusted[bundle.bundleSigningKeyId];
if (!bundlePem) {
  fail("untrusted bundle signing key " + bundle.bundleSigningKeyId);
} else {
  const { bundleSignature, ...unsigned } = bundle;
  const digest = sha256Hex(canonicalJson(unsigned));
  const ok = verify(
    null,
    Buffer.from(digest, "hex"),
    createPublicKey(bundlePem),
    Buffer.from(bundleSignature, "base64"),
  );
  if (!ok) fail("bundle signature invalid");
}

if (failures === 0) {
  console.log(
    "ALL CHECKS PASSED — " +
      bundle.entries.length +
      " receipts verified, chain head " +
      String(bundle.chainHead).slice(0, 16) +
      "\\u2026",
  );
} else {
  console.error(failures + " check(s) failed");
  process.exit(1);
}
`;

const VERIFY_SH = `#!/bin/sh
# Offline verification for a RaksHex signed action-receipt bundle.
# Needs only Node.js 18+. No network access, no npm install.
set -eu
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$DIR/verify.mjs" "$@"
`;

export interface ReceiptExportDownload {
  filename: string;
  contentType: string;
  body: Buffer;
  sha256: string;
  recordCount: number;
  chainHead: string;
}

/**
 * Assemble the full auditor bundle ZIP. Pure apart from buildExport (used
 * for the index.csv — we reuse dataExport.ts instead of re-implementing
 * CSV escaping).
 */
export async function assembleReceiptExportZip(
  bundle: ReceiptBundle,
  exportedBy: string,
): Promise<ReceiptExportDownload> {
  const trustedKeys = trustedKeysFromBundle(bundle);
  const exportedAt = new Date();

  const index = await buildExport({
    format: "csv",
    title: "Action Receipt Index",
    resource: "action_receipts",
    columns: ["id", "requestId", "eventType", "occurredAt", "entryHash", "signingKeyId"],
    columnHeaders: {
      id: "ID",
      requestId: "Request ID",
      eventType: "Event",
      occurredAt: "Occurred At",
      entryHash: "Entry Hash",
      signingKeyId: "Signing Key",
    },
    rows: bundle.entries.map((e) => ({
      id: e.id ?? null,
      requestId: e.requestId,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      entryHash: e.entryHash,
      signingKeyId: e.signingKeyId,
    })),
  });

  const files = [
    { name: "bundle.json", data: Buffer.from(receiptBundleJson(bundle), "utf8") },
    {
      name: "receipts.json",
      data: Buffer.from(`${JSON.stringify(bundle.entries, null, 2)}\n`, "utf8"),
    },
    { name: "index.csv", data: index.body },
    {
      name: "public-keys.json",
      data: Buffer.from(`${JSON.stringify({ keys: trustedKeys }, null, 2)}\n`, "utf8"),
    },
    {
      name: "README.txt",
      data: Buffer.from(
        readmeText({
          workspaceId: bundle.workspaceId,
          exportedBy,
          exportedAt: exportedAt.toISOString(),
          entryCount: bundle.entries.length,
          chainHead: bundle.chainHead,
        }),
        "utf8",
      ),
    },
    { name: "verify.sh", data: Buffer.from(VERIFY_SH, "utf8"), mode: 0o755 },
    { name: "verify.mjs", data: Buffer.from(VERIFY_MJS, "utf8") },
  ];
  const body = buildZip(files, exportedAt);
  const date = exportedAt.toISOString().slice(0, 10);
  return {
    filename: `rakshex-receipts_ws${bundle.workspaceId}_${date}.zip`,
    contentType: "application/zip",
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    recordCount: bundle.entries.length,
    chainHead: bundle.chainHead,
  };
}
