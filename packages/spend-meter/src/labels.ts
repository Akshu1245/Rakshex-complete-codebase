/**
 * Signal labels: every cost number in the spend path carries a provenance
 * label so nothing is ever presented as more certain than it is.
 *
 * - "exact":     the provider reported this number (e.g. usage from a
 *                billing reconciliation file). Treat as ground truth.
 * - "observed":  measured from our own instrumentation (e.g. token counts
 *                from a gateway response). Real, but our measurement.
 * - "estimated": a heuristic or price-table lookup. Order-of-magnitude
 *                only — good enough for a worst-case gate, never for
 *                invoicing or historical repricing.
 * - "not_available": the value is unknown. The gate must DENY fail-closed
 *                rather than guess.
 */
export type SignalLabel = "exact" | "observed" | "estimated" | "not_available";

/** Attach a provenance label to any record. The label travels with the data. */
export function withSignalLabel<T extends object>(
  record: T,
  signalLabel: SignalLabel,
): T & { signalLabel: SignalLabel } {
  return { ...record, signalLabel };
}

/** Guard for label values arriving from untrusted input (API payloads, DB rows). */
export function asSignalLabel(value: unknown): SignalLabel {
  return value === "exact" ||
    value === "observed" ||
    value === "estimated" ||
    value === "not_available"
    ? value
    : "not_available";
}
