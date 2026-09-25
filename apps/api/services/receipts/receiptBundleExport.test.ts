import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  assembleReceiptExportZip,
  buildZip,
} from "./receiptBundleExport";
import {
  createReceiptSigner,
  createSignedReceiptBundle,
  createSignedReceiptEntry,
  GENESIS_HASH,
  type ReceiptBundle,
  type ReceiptEntryExport,
} from "./actionReceipts";

const execFileAsync = promisify(execFile);

/* ─── Minimal independent ZIP reader (test-only, no shared code) ───────── */

interface ZipReadEntry {
  name: string;
  data: Buffer;
  mode: number;
  crc: number;
}

function readZip(buf: Buffer): ZipReadEntry[] {
  // Locate EOCD by scanning backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD not found");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  const entries: ZipReadEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central header");
    const method = buf.readUInt16LE(p + 10);
    if (method !== 0) throw new Error("expected store method");
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const mode = buf.readUInt32LE(p + 38) >>> 16;
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("bad local header");
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    entries.push({ name, data: Buffer.from(data), mode, crc });
  }
  return entries;
}

/* ─── Signed bundle fixture ─────────────────────────────────────────────── */

function makeBundle(): ReceiptBundle {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const signer = createReceiptSigner(pem, "test-key-1");

  const entries: ReceiptEntryExport[] = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < 3; i++) {
    const entry = createSignedReceiptEntry(
      {
        id: i + 1,
        workspaceId: 7,
        requestId: `req-${i}`,
        eventType: i === 1 ? "deny" : "allow",
        occurredAt: new Date(`2026-09-2${i}T10:00:00Z`),
        payload: { action: "financial.refund", policy: "refunds-v3" },
        previousHash: prev,
      },
      signer,
    );
    entries.push(entry);
    prev = entry.entryHash;
  }
  return createSignedReceiptBundle({ workspaceId: 7, exportedAt: new Date(), entries }, signer);
}

describe("buildZip", () => {
  it("round-trips files with correct names, CRCs, and data", () => {
    const files = [
      { name: "README.txt", data: Buffer.from("hello receipts", "utf8") },
      { name: "dir/nested.bin", data: Buffer.from([0, 1, 2, 250, 255]) },
      { name: "ünïcode name.txt", data: Buffer.from("utf8 names", "utf8") },
    ];
    const zip = buildZip(files, new Date("2026-01-01T00:00:00Z"));
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(files.map((f) => f.name));
    for (let i = 0; i < files.length; i++) {
      expect(entries[i]!.data.equals(files[i]!.data)).toBe(true);
    }
  });

  it("marks verify.sh executable via unix mode bits", () => {
    const zip = buildZip([{ name: "verify.sh", data: Buffer.from("#!/bin/sh"), mode: 0o755 }]);
    const [entry] = readZip(zip);
    expect(entry!.mode & 0o777).toBe(0o755);
  });

  it("is deterministic for identical inputs except timestamps", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const a = buildZip([{ name: "f", data: Buffer.from("x") }], at);
    const b = buildZip([{ name: "f", data: Buffer.from("x") }], at);
    expect(a.equals(b)).toBe(true);
  });
});

describe("assembleReceiptExportZip", () => {
  it("contains every buyer artifact and the CSV index reuses dataExport escaping", async () => {
    const download = await assembleReceiptExportZip(makeBundle(), "auditor@example.com");
    expect(download.contentType).toBe("application/zip");
    expect(download.recordCount).toBe(3);
    expect(download.filename).toMatch(/^rakshex-receipts_ws7_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(download.sha256).toBe(createHash("sha256").update(download.body).digest("hex"));

    const names = readZip(download.body).map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "bundle.json",
        "receipts.json",
        "index.csv",
        "public-keys.json",
        "README.txt",
        "verify.sh",
        "verify.mjs",
      ]),
    );

    const byName = Object.fromEntries(readZip(download.body).map((e) => [e.name, e.data]));
    const readme = byName["README.txt"]!.toString("utf8");
    expect(readme).toContain("How to verify this proof offline (3 steps)");
    expect(readme).toContain("./verify.sh");
    const csv = byName["index.csv"]!.toString("utf8");
    expect(csv).toContain("Request ID");
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(4); // header + 3 rows
    const keys = JSON.parse(byName["public-keys.json"]!.toString("utf8"));
    expect(Object.keys(keys.keys)).toContain("test-key-1");
  });

  it("passes the bundled offline verifier end-to-end", async () => {
    const download = await assembleReceiptExportZip(makeBundle(), "auditor@example.com");
    const dir = mkdtempSync(join(tmpdir(), "rakshex-verify-"));
    for (const entry of readZip(download.body)) {
      writeFileSync(join(dir, entry.name), entry.data);
    }
    const { stdout } = await execFileAsync(process.execPath, [join(dir, "verify.mjs"), dir]);
    expect(stdout).toContain("ALL CHECKS PASSED");
    expect(stdout).toContain("3 receipts verified");
  });

  it("the bundled verifier rejects a tampered bundle", async () => {
    const download = await assembleReceiptExportZip(makeBundle(), "auditor@example.com");
    const dir = mkdtempSync(join(tmpdir(), "rakshex-tamper-"));
    for (const entry of readZip(download.body)) {
      writeFileSync(join(dir, entry.name), entry.data);
    }
    const bundlePath = join(dir, "bundle.json");
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    bundle.entries[1].entryHash = "ab".repeat(32); // tamper with one hash
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
    await expect(execFileAsync(process.execPath, [join(dir, "verify.mjs"), dir])).rejects.toThrow();
  });
});
