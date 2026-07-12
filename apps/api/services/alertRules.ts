/**
 * Configurable alert-rule engine.
 *
 * A tenant defines `AlertRule`s — predicates over a fixed set of metrics
 * (`cost_usd`, `blocked_requests`, `redteam_score`, `error_rate`,
 * `anomaly_score`, `latency_p95_ms`). The evaluator, which runs on a cron
 * tick, computes the metric value over the rule's window and emits a
 * triggered event when ALL conditions in the rule match. Combinator support
 * is intentionally narrow: a rule is a conjunction (`AND`) of conditions on
 * the same time window — multi-window rules need separate AlertRule rows.
 *
 * The actual delivery (Discord, PagerDuty, generic webhook) is decoupled —
 * `evaluateAndDispatch` calls into integration services after deciding
 * whether to fire.
 */

export type AlertMetric =
  | "cost_usd"
  | "blocked_requests"
  | "redteam_score"
  | "error_rate"
  | "anomaly_score"
  | "latency_p95_ms";

export type AlertOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertWindow = "1h" | "24h" | "7d";

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
}

export interface AlertChannelConfig {
  /** Generic outbound webhook (existing webhookEndpoints row id). */
  webhookEndpointIds?: number[];
  /** Discord webhook URL (validated, https-only). */
  discordWebhookUrl?: string;
  /** PagerDuty Events API v2 routing key. */
  pagerdutyRoutingKey?: string;
}

export interface AlertRule {
  id: number;
  userId: number;
  name: string;
  enabled: boolean;
  /** All conditions must match (logical AND). */
  conditions: AlertCondition[];
  window: AlertWindow;
  /** Don't re-fire within this many minutes. */
  cooldownMinutes: number;
  severity: AlertSeverity;
  channels: AlertChannelConfig;
  createdAt: Date;
  updatedAt: Date;
  /** When this rule last fired (used for cooldown). */
  lastFiredAt?: Date | null;
}

export interface MetricSnapshot {
  metric: AlertMetric;
  value: number;
  /** Wall-clock at observation time, used for cooldown comparisons. */
  observedAt: Date;
  /** Free-form sample (e.g. "12 requests over the last hour"). */
  sampleNote?: string;
}

export type EvaluationVerdict =
  | { fired: false; reason: "cooldown" | "disabled" | "no_match"; missing?: AlertCondition[] }
  | {
      fired: true;
      severity: AlertSeverity;
      matched: AlertCondition[];
      snapshots: MetricSnapshot[];
      summary: string;
    };

/**
 * Pure rule-evaluation function. Tests use this directly without needing a
 * DB. Snapshots are passed in; the caller is responsible for collecting them
 * (so the same engine works against live data and historical replay).
 */
export function evaluateRule(
  rule: AlertRule,
  snapshots: MetricSnapshot[],
  now: Date,
): EvaluationVerdict {
  if (!rule.enabled) return { fired: false, reason: "disabled" };

  if (rule.lastFiredAt) {
    const elapsedMs = now.getTime() - rule.lastFiredAt.getTime();
    if (elapsedMs < rule.cooldownMinutes * 60_000) {
      return { fired: false, reason: "cooldown" };
    }
  }

  const matched: AlertCondition[] = [];
  const missing: AlertCondition[] = [];
  const usedSnapshots: MetricSnapshot[] = [];
  for (const cond of rule.conditions) {
    const snap = snapshots.find((s) => s.metric === cond.metric);
    if (!snap) {
      missing.push(cond);
      continue;
    }
    if (compareMetric(snap.value, cond.operator, cond.threshold)) {
      matched.push(cond);
      usedSnapshots.push(snap);
    } else {
      missing.push(cond);
    }
  }

  if (missing.length > 0 || matched.length === 0) {
    return { fired: false, reason: "no_match", missing };
  }

  return {
    fired: true,
    severity: rule.severity,
    matched,
    snapshots: usedSnapshots,
    summary: summarize(rule, usedSnapshots),
  };
}

function compareMetric(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
  }
}

function summarize(rule: AlertRule, snapshots: MetricSnapshot[]): string {
  const parts = snapshots.map((s) => `${s.metric}=${formatMetric(s)}`);
  return `[${rule.severity.toUpperCase()}] ${rule.name} — ${parts.join(", ")}`;
}

function formatMetric(s: MetricSnapshot): string {
  if (s.metric === "cost_usd") return `$${s.value.toFixed(2)}`;
  if (s.metric === "error_rate") return `${(s.value * 100).toFixed(1)}%`;
  if (s.metric === "latency_p95_ms") return `${Math.round(s.value)}ms`;
  return String(s.value);
}

/**
 * Validate a rule definition before persisting. Returns a list of human-
 * readable errors (empty array means valid). Used by the tRPC router and
 * the future YAML-policy bridge that lets users describe rules as code.
 */
export function validateRule(
  rule: Omit<AlertRule, "id" | "userId" | "createdAt" | "updatedAt" | "lastFiredAt">,
): string[] {
  const errors: string[] = [];
  if (!rule.name || rule.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (rule.name.length > 192) errors.push("name too long (max 192)");
  if (!["1h", "24h", "7d"].includes(rule.window)) {
    errors.push(`window must be 1h, 24h, or 7d`);
  }
  if (!["low", "medium", "high", "critical"].includes(rule.severity)) {
    errors.push("severity must be low | medium | high | critical");
  }
  if (rule.cooldownMinutes < 1 || rule.cooldownMinutes > 24 * 60) {
    errors.push("cooldownMinutes must be between 1 and 1440");
  }
  if (rule.conditions.length === 0) {
    errors.push("at least one condition is required");
  }
  for (let i = 0; i < rule.conditions.length; i++) {
    const c = rule.conditions[i];
    if (
      ![
        "cost_usd",
        "blocked_requests",
        "redteam_score",
        "error_rate",
        "anomaly_score",
        "latency_p95_ms",
      ].includes(c.metric)
    ) {
      errors.push(`condition[${i}].metric is unknown: ${c.metric}`);
    }
    if (!["gt", "gte", "lt", "lte", "eq"].includes(c.operator)) {
      errors.push(`condition[${i}].operator is unknown: ${c.operator}`);
    }
    if (typeof c.threshold !== "number" || !Number.isFinite(c.threshold)) {
      errors.push(`condition[${i}].threshold must be a finite number`);
    }
  }
  if (rule.channels.discordWebhookUrl) {
    if (
      !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(
        rule.channels.discordWebhookUrl,
      )
    ) {
      errors.push("channels.discordWebhookUrl must be a discord.com /api/webhooks/ URL");
    }
  }
  if (
    !rule.channels.webhookEndpointIds?.length &&
    !rule.channels.discordWebhookUrl &&
    !rule.channels.pagerdutyRoutingKey
  ) {
    errors.push("at least one channel must be configured");
  }
  return errors;
}

/**
 * Helper used by the tRPC endpoints for "test fire" — accepts a manual
 * snapshot dictionary and a rule, returns the verdict so the operator can
 * see what their rule would do without polluting the eval log.
 */
export function dryRunRule(
  rule: AlertRule,
  values: Partial<Record<AlertMetric, number>>,
  now: Date = new Date(),
): EvaluationVerdict {
  const snapshots: MetricSnapshot[] = Object.entries(values).map(([metric, value]) => ({
    metric: metric as AlertMetric,
    value: value as number,
    observedAt: now,
  }));
  return evaluateRule(rule, snapshots, now);
}
