/**
 * Privacy / retention controls: export, deletion, zero-retention, local-only architecture notes.
 */

export type RetentionMode = "standard" | "zero_retention" | "local_only";

export interface RetentionPolicy {
  mode: RetentionMode;
  /** Days to retain telemetry/audit (standard mode) */
  telemetryDays: number;
  auditDays: number;
  /** Soft-delete grace period before hard delete */
  deletionGraceDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  mode: "standard",
  telemetryDays: 90,
  auditDays: 365,
  deletionGraceDays: 30,
};

export interface UserDataExport {
  userId: string;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * Anonymize PII fields for deletion workflows.
 */
export function anonymizeUserRecord<T extends Record<string, unknown>>(
  row: T,
  fields: string[] = ["email", "name", "phone"],
): T {
  const out = { ...row };
  for (const f of fields) {
    if (f in out) {
      (out as Record<string, unknown>)[f] = `anon_${hashish(String(out[f] ?? ""))}`;
    }
  }
  (out as Record<string, unknown>).deletedAt = new Date().toISOString();
  (out as Record<string, unknown>).anonymized = true;
  return out;
}

export function shouldStoreTelemetry(mode: RetentionMode): boolean {
  return mode === "standard";
}

/** Network shipping of telemetry is only for standard retention. */
export function networkTelemetryAllowed(mode: RetentionMode): boolean {
  return mode === "standard";
}

function hashish(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
