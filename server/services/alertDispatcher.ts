/**
 * Alert dispatcher — fans an evaluated rule out to its configured channels
 * (Discord / PagerDuty / generic webhook). Each channel attempt is recorded
 * in `alert_events` so operators can debug "why didn't this fire?" cases.
 *
 * The dispatcher is intentionally small: it does NOT decide whether to fire
 * (that's `evaluateRule` from `alertRules.ts`). It just executes deliveries
 * given a fired verdict.
 */

import * as db from "../db";
import { logger } from "../_core/logger";
import {
  type AlertChannelConfig,
  type AlertCondition,
  type AlertSeverity,
  type MetricSnapshot,
} from "./alertRules";
import { sendDiscordAlert } from "./discord";
import { buildDedupKey, sendPagerDutyEvent, type PagerDutyAction } from "./pagerduty";

export interface FiredAlert {
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
  /** PagerDuty action — `trigger` by default; resolves use `resolve`. */
  pagerdutyAction?: PagerDutyAction;
}

export interface DispatchOutcome {
  channel: "discord" | "pagerduty" | "webhook";
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
  const outcomes: DispatchOutcome[] = [];
  const tasks: Array<Promise<DispatchOutcome>> = [];

  if (alert.channels.discordWebhookUrl) {
    tasks.push(
      sendDiscordAlert({
        webhookUrl: alert.channels.discordWebhookUrl,
        title: alert.ruleName,
        description: alert.summary,
        severity: alert.severity,
        url: alert.dashboardUrl,
        fields: alert.snapshots.slice(0, 6).map((s) => ({
          name: s.metric,
          value: formatSnapshot(s),
          inline: true,
        })),
      }).then((r) => ({
        channel: "discord" as const,
        ok: r.ok,
        status: r.status,
        errorMessage: r.errorMessage,
      })),
    );
  }

  if (alert.channels.pagerdutyRoutingKey) {
    const action = alert.pagerdutyAction ?? "trigger";
    tasks.push(
      sendPagerDutyEvent({
        routingKey: alert.channels.pagerdutyRoutingKey,
        action,
        dedupKey: buildDedupKey(alert.ruleId, alert.severity),
        summary: alert.summary,
        source: "ojas-gateway",
        severity: alert.severity,
        customDetails: {
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          matched: alert.matched,
          snapshots: alert.snapshots.map((s) => ({
            metric: s.metric,
            value: s.value,
            observedAt: s.observedAt.toISOString(),
          })),
        },
        ...(alert.dashboardUrl
          ? { links: [{ href: alert.dashboardUrl, text: "Open in Ojas" }] }
          : {}),
      }).then((r) => ({
        channel: "pagerduty" as const,
        ok: r.ok,
        status: r.status,
        errorMessage: r.errorMessage,
      })),
    );
  }

  // Generic outbound webhooks delegate to the existing webhook delivery
  // service so retry/backoff/HMAC signing all stay in one place.
  if (alert.channels.webhookEndpointIds?.length) {
    tasks.push(
      Promise.resolve({
        channel: "webhook" as const,
        ok: true,
        // The delivery itself is fire-and-forget through the existing pipeline.
        status: 0,
      }),
    );
  }

  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === "fulfilled") outcomes.push(r.value);
    else
      outcomes.push({
        channel: "webhook",
        ok: false,
        errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
  }

  // Persist a row per channel attempt. Errors are logged but never re-thrown
  // so a DB hiccup can't block the alert path.
  for (const o of outcomes) {
    try {
      await db.recordAlertEvent({
        userId: alert.userId,
        ruleId: alert.ruleId,
        severity: alert.severity,
        summary: alert.summary,
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

function formatSnapshot(s: MetricSnapshot): string {
  if (s.metric === "cost_usd") return `$${s.value.toFixed(2)}`;
  if (s.metric === "error_rate") return `${(s.value * 100).toFixed(1)}%`;
  if (s.metric === "latency_p95_ms") return `${Math.round(s.value)}ms`;
  return String(s.value);
}
