/**
 * Helpers for converting Drizzle `decimal(...)` columns into JavaScript numbers.
 *
 * MySQL `DECIMAL` is returned as a string by the underlying driver to preserve
 * precision. Most product code only needs a `number`, so we centralize the
 * conversion here instead of sprinkling `parseFloat(value as any)` casts.
 *
 * Use `toNumber` when the value is required and a missing/invalid input
 * should fall back to `0` (or an explicit fallback). Use `toNumberOrNull`
 * when the column is nullable and the caller wants to distinguish "absent"
 * from "zero".
 */

export type DecimalLike = string | number | null | undefined;

export function toNumber(value: DecimalLike, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNumberOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
