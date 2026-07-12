import { createHash } from "node:crypto";

/** SHA-256 hex digest of UTF-8 string. Used instead of storing prompt content. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function randomId(): string {
  return cryptoRandomUuid();
}

function cryptoRandomUuid(): string {
  // Node 18+ / browsers
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Fallback
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32)
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}
