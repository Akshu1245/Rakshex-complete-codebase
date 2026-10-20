import { createHash } from "node:crypto";
/** Deterministic JSON (sorted keys) so hashes are stable across runs/machines. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const digest = (v: unknown) => sha256(canonical(v));
