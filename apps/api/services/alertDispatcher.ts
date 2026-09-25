/**
 * Alert dispatcher — fans an evaluated rule out to its configured channels
 * (email / generic webhook / Slack / Teams). Each channel attempt is
 * recorded in `alert_events` so operators can debug "why didn't this fire?"
 * cases.
 *
 * The dispatcher is intentionally small: it does NOT decide whether to fire
 * (that's `evaluateRule` from `alertRules.ts`). It just executes deliveries
 * given a fired verdict.
 *
 * Two high-value alert builders live here so producers stay decoupled from
 * channel wiring:
 * - `fireCeilingAlert` — spend-ceiling hit / near-ceiling warning. The
 *   payload shape (`CeilingAlertPayload`) is defined here; the ceiling
 *   owner (B1) just calls it.
 * - `fireApprovalRequest` — approval-requested card with signed
 *   Approve / Reject actions on Slack / Teams / email.
 */

import * as db from "../db";
import { logger } from "../_core/logger";
import { ENV } from "../_core/env";
import {
  type AlertChannelConfig,
  type AlertCondition,
  type AlertSeverity,
  type MetricSnapshot,
} from "./alertRules";
import { type SignalLabel, labelSuffix } from "./alertSignals";
import { buildApprovalCallbackUrl } from "./approvalCallbacks";
import { sendSlackAlert, type SlackApprovalActions } from "./slack";
import { sendTeamsAlert, type TeamsApprovalActions } from "./teams";
import { sendAlertEmail } from "../email";

export type DispatchChannel = "email" | "webhook" | "slack" | "teams";

export interface FiredAlert {
  /** Alert-rule id; 0 for non-rule alerts (ceiling / approval) — see below. */
  ruleId: number;
  userId: number;
  ruleName: string;
  severity: AlertSeverity;
  summary: string;
  matched: AlertCondition[];
  snapshots: MetricSnapshot[];
  channels: AlertChannelConfig;
  /** Optional dashboard deep-link to surface in the alert body. */
  dashboardUrl?: string;
  /** Honesty signal — every alert payload carries one. */
  signalLabel: SignalLabel;
  /**
   * When set, Slack / Teams / email include signed Approve / Reject
   * actions that consume the approval via `/api/approval-callbacks`.
   */
  approval?: { approvalId: string; actionSummary: string };
}

export interface DispatchOutcome {
  channel: DispatchChannel;
  ok: boolean;
  status?: number;
  errorMessage?: string;
}

/**
 * Run every configured channel concurrently and collect outcomes. Each
 * outcome is also persisted to `alert_events` so the dashboard can show
 * delivery history per rule.
 */
export async function dispatchAlert(alert: FiredAlert): Promise<DispatchOutcome[]> {
  const tasks: Array<Promise<DispatchOutcome>> = [];
  const channelNames: DispatchChannel[] = [];

  if (alert.channels.emailTo?.length) {
    tasks.push(sendEmailChannel(alert));
    channelNames.push("email");
  }

  if (alert.channels.webhookEndpointIds?.length) {
    tasks.push(sendWebhookChannel(alert));
    channelNames.push("webhook");
  }

  if (alert.channels.slack) {
    tasks.push(
      sendSlackAlert(alert.channels.slack, toSlackAlert(alert)).then((r) => ({
        channel: "slack" as const,
        ok: r.ok,
        status: r.status,
        errorMessage: r.errorMessage,
      })),
    );
    channelNames.push("slack");
  }

  if (alert.channels.teams) {
    tasks.push(
      sendTeamsAlert(alert.channels.teams, toTeamsAlert(alert)).then((r) => ({
        channel: "teams" as const,
        ok: r.ok,
        status: r.status,
        errorMessage: r.errorMessage,
      })),
    );
    channelNames.push("teams");
  }

  const settled = await Promise.allSettled(tasks);
  // Channel senders are all non-throwing by contract, but if one ever
  // rejects, report it under its own channel — not a hardcoded "webhook".
  const outcomes: DispatchOutcome[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          channel: channelNames[i],
          ok: false,
          errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
        },
  );

  // Persist a row per channel attempt. Errors are logged but never re-thrown
  // so a DB hiccup can't block the alert path.
  for (const o of outcomes) {
    try {
      await db.recordAlertEvent({
        userId: alert.userId,
        ruleId: alert.ruleId,
        severity: alert.severity,
        summary: alert.summary.slice(0, 512),
        matched: alert.matched,
        snapshots: alert.snapshots.map((s) => ({
          metric: s.metric,
          value: s.value,
          observedAt: s.observedAt.toISOString(),
        })),
        channel: o.channel,
        delivered: o.ok,
        statusCode: o.status,
        errorMessage: o.errorMessage,
      });
    } catch (err) {
      logger.warn(
        { err, ruleId: alert.ruleId, channel: o.channel },
        "[Alerts] failed to persist alert_event",
      );
    }
  }

  return outcomes;
}

// ── channel senders ──────────────────────────────────────────────────────────

async function sendEmailChannel(alert: FiredAlert): Promise<DispatchOutcome> {
  const recipients = alert.channels.emailTo ?? [];
  const text = buildEmailBody(alert);
  const subject = `[${alert.severity.toUpperCase()}] ${alert.ruleName}`;
  let failed = 0;
  for (const to of recipients) {
    try {
      await sendAlertEmail({ toEmail: to, subject, text });
    } catch (err) {
      failed++;
      logger.warn({ err, to }, "[AlertDispatcher] alert email failed");
    }
  }
  return {
    channel: "email",
    ok: failed === 0,
    status: failed === 0 ? 200 : 207,
    ...(failed > 0 ? { errorMessage: `${failed}/${recipients.length} recipients failed` } : {}),
  };
}

async function sendWebhookChannel(alert: FiredAlert): Promise<DispatchOutcome> {
  // Generic outbound webhooks — deliver via the existing webhook pipeline so
  // retry/backoff/HMAC signing all stay in one place.
  try {
    const { deliver } = await import("./webhookDelivery");
    const results = await deliver(alert.userId, "alert.fired", {
      ruleId: alert.ruleId,
      ruleName: alert.ruleName,
      severity: alert.severity,
      summary: alert.summary,
      signalLabel: alert.signalLabel,
      ...(alert.approval ? { approvalId: alert.approval.approvalId } : {}),
      snapshots: alert.snapshots.map((s) => ({
        metric: s.metric,
        value: s.value,
        observedAt: s.observedAt.toISOString(),
      })),
    });
    const anyFailed = results.some((r) => r.status === "failed");
    return { channel: "webhook", ok: !anyFailed, status: anyFailed ? 207 : 200 };
  } catch (err) {
    logger.warn({ err }, "[AlertDispatcher] Webhook delivery failed");
    return {
      channel: "webhook",
      ok: false,
      status: 0,
      errorMessage: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ── shaping ──────────────────────────────────────────────────────────────────

function approvalActions(approval: FiredAlert["approval"]): {
  slack: SlackApprovalActions;
  teams: TeamsApprovalActions;
} {
  const base = ENV.appUrl;
  const mk = (decision: "approve" | "reject") =>
    approval ? buildApprovalCallbackUrl(base, approval.approvalId, decision) : null;
  const actions = { approveUrl: mk("approve"), rejectUrl: mk("reject") };
  return { slack: actions, teams: actions };
}

function toSlackAlert(alert: FiredAlert) {
  return {
    title: alert.ruleName,
    summary: alert.summary,
    severity: alert.severity,
    fields: alert.snapshots.slice(0, 10).map((s) => ({
      name: s.metric,
      value: formatSnapshot(s),
    })),
    url: alert.dashboardUrl,
    signalLabel: alert.signalLabel,
    approval: alert.approval ? approvalActions(alert.approval).slack : undefined,
  };
}

function toTeamsAlert(alert: FiredAlert) {
  return {
    title: alert.ruleName,
    summary: alert.summary,
    severity: alert.severity,
    facts: alert.snapshots.slice(0, 10).map((s) => ({
      name: s.metric,
      value: formatSnapshot(s),
    })),
    url: alert.dashboardUrl,
    signalLabel: alert.signalLabel,
    approval: alert.approval ? approvalActions(alert.approval).teams : undefined,
  };
}

function buildEmailBody(alert: FiredAlert): string {
  const lines = [
    `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
    "",
    alert.summary,
    "",
    ...alert.snapshots.map((s) => `${s.metric}: ${formatSnapshot(s)}`),
    "",
    `signal: ${alert.signalLabel}${labelSuffix(alert.signalLabel)}`,
  ];
  if (alert.approval) {
    const { slack } = approvalActions(alert.approval);
    if (slack.approveUrl || slack.rejectUrl) {
      lines.push("", `Action requested: ${alert.approval.actionSummary}`);
      if (slack.approveUrl) lines.push(`Approve: ${slack.approveUrl}`);
      if (slack.rejectUrl) lines.push(`Reject: ${slack.rejectUrl}`);
      lines.push("Links expire in 30 minutes.");
    }
  }
  if (alert.dashboardUrl) lines.push("", `Open in RaksHex: ${alert.dashboardUrl}`);
  return lines.join("\n");
}

function formatSnapshot(s: MetricSnapshot): string {
  if (s.metric === "cost_usd") return `$${s.value.toFixed(2)}`;
  if (s.metric === "error_rate") return `${(s.value * 100).toFixed(1)}%`;
  if (s.metric === "latency_p95_ms") return `${Math.round(s.value)}ms`;
  return String(s.value);
}

// ── high-value alert builders ────────────────────────────────────────────────

/**
 * Spend-ceiling alert payload. Defined here (decoupled from B1's ceiling
 * types): the ceiling owner fills these five fields and calls
 * `fireCeilingAlert`; the dispatcher handles channel wiring.
 */
export interface CeilingAlertPayload {
  scopeType: string;
  scopeId: string;
  ceilingUsd: number;
  usedUsd: number;
  /** Projected spend — may be absent when the producer can't compute it. */
  estimatedUsd?: number;
  signalLabel: SignalLabel;
}

export const CEILING_WARNING_RATIO = 0.88;

/** Fire a ceiling-hit / near-ceiling alert through the collapsed dispatcher. */
export async function fireCeilingAlert(
  userId: number,
  payload: CeilingAlertPayload,
  channels: AlertChannelConfig,
  dashboardUrl?: string,
): Promise<DispatchOutcome[]> {
  const ratio = payload.ceilingUsd > 0 ? payload.usedUsd / payload.ceilingUsd : 0;
  const hit = payload.usedUsd >= payload.ceilingUsd;
  const severity: AlertSeverity = hit ? "critical" : ratio >= CEILING_WARNING_RATIO ? "high" : "medium";
  const pct = (ratio * 100).toFixed(1);
  const summary =
    `Spend ceiling ${hit ? "HIT" : "warning"} — ${payload.scopeType}:${payload.scopeId} ` +
    `used $${payload.usedUsd.toFixed(2)} of $${payload.ceilingUsd.toFixed(2)} (${pct}%)` +
    (payload.estimatedUsd !== undefined
      ? `, projected $${payload.estimatedUsd.toFixed(2)}`
      : "") +
    labelSuffix(payload.signalLabel);
  const now = new Date();
  return dispatchAlert({
    ruleId: 0, // sentinel: non-rule alert; alert_events.ruleId is a plain integer
    userId,
    ruleName: hit ? "Spend ceiling hit" : "Spend ceiling warning",
    severity,
    summary,
    matched: [],
    snapshots: [
      { metric: "cost_usd", value: payload.usedUsd, observedAt: now },
      ...(payload.estimatedUsd !== undefined
        ? [{ metric: "cost_usd" as const, value: payload.estimatedUsd, observedAt: now }]
        : []),
    ],
    channels,
    dashboardUrl,
    signalLabel: payload.signalLabel,
  });
}

/** Approval-requested card payload — the alert carries signed Approve/Reject actions. */
export interface ApprovalRequestPayload {
  approvalId: string;
  actionSummary: string;
  severity?: AlertSeverity;
  dashboardUrl?: string;
  signalLabel?: SignalLabel;
}

/** Fire an approval-requested alert through the collapsed dispatcher. */
export async function fireApprovalRequest(
  userId: number,
  payload: ApprovalRequestPayload,
  channels: AlertChannelConfig,
): Promise<DispatchOutcome[]> {
  return dispatchAlert({
    ruleId: 0, // sentinel: non-rule alert
    userId,
    ruleName: "Approval requested",
    severity: payload.severity ?? "high",
    summary: `Human approval requested — ${payload.actionSummary}`,
    matched: [],
    snapshots: [],
    channels,
    dashboardUrl: payload.dashboardUrl,
    signalLabel: payload.signalLabel ?? "not_available",
    approval: { approvalId: payload.approvalId, actionSummary: payload.actionSummary },
  });
}
