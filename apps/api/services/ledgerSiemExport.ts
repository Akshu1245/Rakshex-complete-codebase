/**
 * Action Ledger -> SIEM export.
 *
 * Enterprise buyers do not accept a security control whose evidence only lives
 * inside the vendor's dashboard; it has to land in their own SIEM, where their
 * detection rules and retention policies already are. `@rakshex/siem-export`
 * has emitted CEF / RFC 5424 syslog / Splunk HEC / NDJSON since it was
 * written, but nothing ever called it — this module is the missing wire.
 *
 * The Action Ledger is the right source: it is the hash-chained record of
 * every authorization decision, which is exactly the artifact a SOC wants,
 * and it is already redacted at write time (`parametersRedacted`).
 *
 * Severity mapping is deliberate rather than uniform. A DENY is the signal a
 * SOC actually wants paged on — an agent tried to do something it was not
 * authorized to do. A shadow-mode DENY is *not* the same event: nothing was
 * blocked, the policy is still being tuned, and paging on it during a rollout
 * would train the team to ignore the alert. So shadow decisions are demoted.
 */
import { exportSiemEvents, type SecurityEventRecord, type SiemFormat } from "@rakshex/siem-export";

/** The ledger fields this mapper needs. Kept structural so it is testable. */
export interface LedgerRowForSiem {
  id: string;
  workspaceId: number;
  agentId: string | null;
  principalUserId: number | null;
  semanticAction: string;
  decision: string;
  effectiveDecision: string;
  mode: string;
  reasons?: unknown;
  resource?: string | null;
  environment?: string | null;
  amountMinor?: string | number | null;
  currency?: string | null;
  outcomeStatus?: string | null;
  recordHash?: string | null;
  occurredAt: Date | string | null;
}

/**
 * Maps a decision onto SIEM severity.
 *
 * Enforced blocks are high/critical because someone's agent was actually
 * stopped. Shadow-mode findings are "low": informative during rollout, not
 * actionable. ALLOW is "info" — needed for the audit trail, not for alerting.
 */
export function severityFor(row: {
  decision: string;
  effectiveDecision: string;
  mode: string;
}): SecurityEventRecord["severity"] {
  const enforced = row.mode === "enforce";
  if (row.decision === "ALLOW") return "info";
  if (!enforced) return "low";
  switch (row.decision) {
    case "FREEZE":
      return "critical";
    case "DENY":
// An enforced denial is the headline event for a SOC.
      return "high";
    case "APPROVAL_REQUIRED":
    case "PAUSE":
    case "LIMIT":
      return "medium";
    default:
      return "medium";
  }
}

function reasonText(reasons: unknown): string {
  if (Array.isArray(reasons)) return reasons.filter((r) => typeof r === "string").join("; ");
  if (typeof reasons === "string") return reasons;
  return "";
}

export function ledgerRowToSecurityEvent(row: LedgerRowForSiem): SecurityEventRecord {
  const occurred = row.occurredAt ? new Date(row.occurredAt) : new Date();
  const timestamp = Number.isNaN(occurred.getTime())
    ? new Date().toISOString()
    : occurred.toISOString();

  const verdict = row.decision === "ALLOW" ? "allowed" : `${row.decision.toLowerCase()}`;
  const message =
    `Agent action ${row.semanticAction} ${verdict}` +
    (row.mode === "shadow" ? " (shadow mode — not enforced)" : "") +
    (reasonText(row.reasons) ? `: ${reasonText(row.reasons)}` : "");

  return {
    id: row.id,
    timestamp,
    workspaceId: String(row.workspaceId),
    actor: row.agentId ?? (row.principalUserId != null ? `user:${row.principalUserId}` : undefined),
    action: row.semanticAction,
    severity: severityFor(row),
    source: "rakshex.agent-firewall",
    message,
    fields: {
      decision: row.decision,
      effectiveDecision: row.effectiveDecision,
      mode: row.mode,
      resource: row.resource ?? null,
      environment: row.environment ?? null,
      amountMinor: row.amountMinor == null ? null : Number(row.amountMinor),
      currency: row.currency ?? null,
      outcomeStatus: row.outcomeStatus ?? null,
      // The chain hash lets the receiving SIEM verify the record was not
      // altered in transit or after the fact — the tamper-evidence only means
      // something if it travels with the event.
      recordHash: row.recordHash ?? null,
      principalUserId: row.principalUserId ?? null,
    },
  };
}

export function exportLedgerToSiem(rows: LedgerRowForSiem[], format: SiemFormat) {
  return exportSiemEvents(rows.map(ledgerRowToSecurityEvent), format);
}
