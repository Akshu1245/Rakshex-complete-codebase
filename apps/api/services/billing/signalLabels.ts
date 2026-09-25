/**
 * Honesty labels for every quota/spend/cost figure the billing layer
 * surfaces. The string union is identical to B1's gate-side labels — the
 * same four words, so dashboards can render them uniformly.
 *
 * Semantics (billing layer):
 * - "exact":        the provider contractually guarantees the figure is
 *                   final at read time. NONE of the reconciliation sources
 *                   below qualify — see each entry's comment.
 * - "observed":     measured by the provider (reconciliation-grade, not
 *                   real-time) or derived from our own ledger. True read,
 *                   known latency.
 * - "estimated":    modeled (price table x usage). Never presented as
 *                   billed truth.
 * - "not_available": nothing was measured. Never null, never fabricated,
 *                   never 0-as-placeholder.
 */
export type SignalLabel = "exact" | "observed" | "estimated" | "not_available";

/**
 * Labeling policy per reconciliation data class. Import this instead of
 * hand-writing labels so a wrong label is a single-line, reviewable diff.
 */
export const RECONCILIATION_LABELS = {
  // OpenAI costs API revises buckets for hours after they close (documented
  // late-arriving usage); finality is NOT guaranteed at read time.
  openAiReportedCost: "observed",
  // Anthropic admin API is ~5 minutes delayed and subject to post-hoc
  // adjustments; observed, not exact.
  anthropicReportedCost: "observed",
  // Google billing export lands 24-48h late and rows can restate within the
  // month as credits/adjustments land; observed, not exact.
  googleExportedCost: "observed",
  // Our own ledger attribution (team_ai_usage_events): derived from gateway
  // metering, not provider truth; observed.
  ledgerAttributedCost: "observed",
  // modelPriceRegistry x token counts: pure model, never billed truth.
  modeledCost: "estimated",
  // Provider unreachable / key missing / export not configured: say so.
  missingProviderData: "not_available",
} as const satisfies Record<string, SignalLabel>;

export type ReconciliationLabelKey = keyof typeof RECONCILIATION_LABELS;
