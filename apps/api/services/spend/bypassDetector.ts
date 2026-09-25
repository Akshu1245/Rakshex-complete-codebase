/**
 * Direct-provider-key bypass detector (Team B, meter core).
 *
 * Compares provider-reported usage (key fingerprints from billing
 * reconciliation input) against the fingerprints the broker actually issued.
 * Spend on a fingerprint the broker never issued means the key is being used
 * directly against the provider — bypassing RaksHex's enforcement gate,
 * metering, and signed receipts.
 *
 * This returns FINDINGS only. No auto-punish, no auto-revoke, no credential
 * rotation: the enforcement team decides what happens next. A detector that
 * punishes on heuristic evidence is a liability, not a control.
 */
export const DIRECT_PROVIDER_KEY_BYPASS = "DIRECT_PROVIDER_KEY_BYPASS" as const;

export interface ReconciledKeyUsage {
  /** Key fingerprint as reported by the provider's billing/usage export. */
  keyFingerprint: string;
  provider: string;
  /** USD attributed to this fingerprint in the reconciliation window. */
  costUsd: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface DirectKeyBypassFinding {
  type: typeof DIRECT_PROVIDER_KEY_BYPASS;
  keyFingerprint: string;
  provider: string;
  costUsd: number;
  /** Always false for this finding: the fingerprint was NOT broker-issued. */
  issuedByBroker: false;
  detail: string;
}

/**
 * Flag every reconciled fingerprint the broker never issued. Rows with an
 * empty fingerprint are skipped — unattributable spend is a data-quality
 * gap, not evidence of bypass.
 */
export function detectDirectProviderKeyBypass(
  brokerIssuedFingerprints: ReadonlySet<string>,
  reconciledUsage: readonly ReconciledKeyUsage[],
): DirectKeyBypassFinding[] {
  const findings: DirectKeyBypassFinding[] = [];
  for (const row of reconciledUsage) {
    const fingerprint = row.keyFingerprint?.trim();
    if (!fingerprint) continue;
    if (brokerIssuedFingerprints.has(fingerprint)) continue;
    findings.push({
      type: DIRECT_PROVIDER_KEY_BYPASS,
      keyFingerprint: fingerprint,
      provider: row.provider,
      costUsd: row.costUsd,
      issuedByBroker: false,
      detail:
        `Provider-reported spend of $${row.costUsd.toFixed(2)} on key fingerprint ` +
        `${fingerprint} (${row.provider}), which the broker never issued: ` +
        `possible direct provider key bypassing RaksHex enforcement and metering.`,
    });
  }
  return findings;
}
