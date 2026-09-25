/**
 * Honesty signal labels — every alert payload carries one so operators can
 * tell at a glance whether a number is measured, inferred, or unknown.
 *
 * - `exact`: computed deterministically from authoritative records
 *   (e.g. ledger-summed spend).
 * - `observed`: measured from telemetry, subject to sampling/ingest lag.
 * - `estimated`: projected/derived (e.g. forecast burn to end of period).
 * - `not_available`: the value could not be determined — shown as "n/a",
 *   never silently treated as zero.
 *
 * Defined once here and re-exported by the alert modules so the string
 * union stays identical everywhere.
 */

export type SignalLabel = "exact" | "observed" | "estimated" | "not_available";

export const SIGNAL_LABELS: readonly SignalLabel[] = [
  "exact",
  "observed",
  "estimated",
  "not_available",
];

export function isSignalLabel(v: unknown): v is SignalLabel {
  return typeof v === "string" && (SIGNAL_LABELS as readonly string[]).includes(v);
}

/** Human-readable suffix used in alert bodies, e.g. "$412.55 (estimated)". */
export function labelSuffix(label: SignalLabel): string {
  return label === "exact" ? "" : ` (${label.replace("_", " ")})`;
}
