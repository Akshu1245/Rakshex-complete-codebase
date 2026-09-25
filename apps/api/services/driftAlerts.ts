/**
 * B4 reconciliation → B2 alerts adapter.
 *
 * B4's reconciliation worker takes an `onDrift` callback (see
 * `apps/api/services/billing/reconciliationWorker.ts`, `DriftAlert`). This
 * module turns that callback into real alert delivery: pass the handler
 * returned by `wireDriftAlerts` as the worker's `onDrift` and drift events
 * fan out through the collapsed dispatcher (email / webhook / Slack / Teams).
 *
 * One-line wiring (billing owns the call, we own the delivery):
 *   startReconciliationWorker({ ..., onDrift: wireDriftAlerts(resolveDriftTarget) })
 *
 * Dependency direction stays billing → alerts via callback: this module
 * does NOT import anything from `services/billing` — the `DriftAlert`
 * shape is declared structurally so both sides keep their own interface
 * (labels use the same four SignalLabel words).
 */

import { logger } from "../_core/logger";
import { dispatchAlert, type DispatchOutcome } from "./alertDispatcher";
import { type AlertChannelConfig, type AlertSeverity } from "./alertRules";
import { type SignalLabel } from "./alertSignals";

/**
 * Structural mirror of B4's `DriftAlert` — no import, no dependency.
 */
export interface DriftAlertPayload {
  provider: string;
  workspaceId: number;
  providerAccountId: number;
  windowStart: string | Date;
  windowEnd: string | Date;
  providerReportedUsd: number;
  ledgerAttributedUsd: number;
  driftUsd: number;
  /** Signed percent, e.g. -3.2 or 5.7. */
  driftPct: number;
  providerLabel: SignalLabel;
  ledgerLabel: SignalLabel;
  /** Human-readable provider data latency, e.g. "hours late", "~5min delayed". */
  providerDataLatency: string;
}

export interface DriftAlertTarget {
  /** Owner of the alert_events rows (e.g. the workspace owner). */
  userId: number;
  channels: AlertChannelConfig;
  dashboardUrl?: string;
}

/** Resolve a workspace to its alert target; null = no alert wiring for it. */
export type ResolveDriftTarget = (workspaceId: number) => DriftAlertTarget | null;

/** Compatible with B4's `OnDriftAlert`. Never throws. */
export type OnDriftLike = (alert: DriftAlertPayload) => void | Promise<void>;

const DRIFT_HIGH_PCT = 10;
const DRIFT_MEDIUM_PCT = 2;

const LABEL_RANK: Record<SignalLabel, number> = {
  exact: 3,
  observed: 2,
  estimated: 1,
  not_available: 0,
};

/** The drift number is only as trustworthy as its weaker side. */
export function weakerLabel(a: SignalLabel, b: SignalLabel): SignalLabel {
  return LABEL_RANK[a] <= LABEL_RANK[b] ? a : b;
}

function driftSeverity(driftPct: number): AlertSeverity {
  const p = Math.abs(driftPct);
  if (p >= DRIFT_HIGH_PCT) return "high";
  if (p >= DRIFT_MEDIUM_PCT) return "medium";
  return "low";
}

/**
 * Build the B2 `onDrift` handler. Resolves the workspace's alert target,
 * shapes the drift event into a `FiredAlert` with an honest combined
 * signal label, and fans it out via the dispatcher. Any failure (missing
 * target, dispatcher error) is logged — never thrown — so the billing
 * worker keeps ticking.
 */
export function wireDriftAlerts(resolveTarget: ResolveDriftTarget): OnDriftLike {
  return async (alert: DriftAlertPayload) => {
    let target: DriftAlertTarget | null;
    try {
      target = resolveTarget(alert.workspaceId);
    } catch (err) {
      logger.warn({ err, workspaceId: alert.workspaceId }, "[DriftAlerts] target resolution failed");
      return;
    }
    if (!target) {
      logger.info(
        { workspaceId: alert.workspaceId },
        "[DriftAlerts] no alert target for workspace — drift alert skipped",
      );
      return;
    }

    const signalLabel = weakerLabel(alert.providerLabel, alert.ledgerLabel);
    const severity = driftSeverity(alert.driftPct);
    const dir = alert.driftUsd >= 0 ? "over" : "under";
    const summary =
      `Billing drift (${alert.provider}) — provider $${alert.providerReportedUsd.toFixed(2)} ` +
      `(${alert.providerLabel}) vs ledger $${alert.ledgerAttributedUsd.toFixed(2)} ` +
      `(${alert.ledgerLabel}): ${dir} by $${Math.abs(alert.driftUsd).toFixed(2)} ` +
      `(${alert.driftPct.toFixed(1)}%). Provider data ${alert.providerDataLatency}.`;
    const now = new Date();

    try {
      const outcomes: DispatchOutcome[] = await dispatchAlert({
        ruleId: 0, // sentinel: non-rule alert
        userId: target.userId,
        ruleName: `Billing drift: ${alert.provider}`,
        severity,
        summary,
        matched: [],
        snapshots: [
          { metric: "cost_usd", value: alert.providerReportedUsd, observedAt: now },
          { metric: "cost_usd", value: alert.ledgerAttributedUsd, observedAt: now },
        ],
        channels: target.channels,
        dashboardUrl: target.dashboardUrl,
        signalLabel,
      });
      const failed = outcomes.filter((o) => !o.ok).length;
      if (failed > 0) {
        logger.warn(
          { workspaceId: alert.workspaceId, failed },
          "[DriftAlerts] some drift-alert channels failed",
        );
      }
    } catch (err) {
      logger.warn({ err, workspaceId: alert.workspaceId }, "[DriftAlerts] dispatch failed");
    }
  };
}
