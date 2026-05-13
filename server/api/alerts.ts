/**
 * Alert-rules tRPC router (Sprint 6 / Domain 2).
 *
 * Endpoints:
 *  - listRules / getRule / createRule / updateRule / setEnabled / deleteRule
 *  - listEvents — recent alert dispatches (success/failure rows)
 *  - dryRun — evaluate a rule against operator-supplied metric values; no
 *    persistence and no fan-out, used by the dashboard's "test fire" button
 *  - testDelivery — send a single synthetic alert through the configured
 *    channels so users can verify their Discord/PagerDuty wiring without
 *    waiting for a real condition to fire
 */

import { z } from "zod";

import * as db from "../db";
import { ValidationError } from "../_core/errors";
import { protectedProcedure, router } from "../_core/trpc";
import {
  type AlertCondition,
  type AlertChannelConfig,
  type AlertRule,
  type AlertSeverity,
  type AlertWindow,
  type AlertOperator,
  type MetricSnapshot,
  dryRunRule,
  evaluateRule,
  validateRule,
} from "../services/alertRules";
import { dispatchAlert } from "../services/alertDispatcher";

const metricEnum = z.enum([
  "cost_usd",
  "blocked_requests",
  "redteam_score",
  "error_rate",
  "anomaly_score",
  "latency_p95_ms",
]);

const opEnum = z.enum(["gt", "gte", "lt", "lte", "eq"]);
const windowEnum = z.enum(["1h", "24h", "7d"]);
const severityEnum = z.enum(["low", "medium", "high", "critical"]);

const conditionSchema = z.object({
  metric: metricEnum,
  operator: opEnum,
  threshold: z.number().finite(),
});

const channelsSchema = z.object({
  webhookEndpointIds: z.array(z.number().int().positive()).optional(),
  discordWebhookUrl: z.string().url().optional(),
  pagerdutyRoutingKey: z.string().min(16).max(64).optional(),
});

const ruleInputSchema = z.object({
  name: z.string().min(1).max(192),
  enabled: z.boolean().default(true),
  conditions: z.array(conditionSchema).min(1).max(8),
  window: windowEnum,
  cooldownMinutes: z.number().int().min(1).max(1440),
  severity: severityEnum,
  channels: channelsSchema,
});

function rowToAlertRule(row: {
  id: number;
  userId: number;
  name: string;
  enabled: boolean;
  conditions: unknown;
  window: AlertWindow;
  cooldownMinutes: number;
  severity: AlertSeverity;
  channels: unknown;
  lastFiredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AlertRule {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    enabled: row.enabled,
    conditions: row.conditions as AlertCondition[],
    window: row.window,
    cooldownMinutes: row.cooldownMinutes,
    severity: row.severity,
    channels: row.channels as AlertChannelConfig,
    lastFiredAt: row.lastFiredAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const alertsRouter = router({
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.listAlertRules(ctx.user.id);
    return rows.map(rowToAlertRule);
  }),

  getRule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const row = await db.getAlertRule(ctx.user.id, input.id);
      if (!row) throw new ValidationError("alert rule not found");
      return rowToAlertRule(row);
    }),

  createRule: protectedProcedure
    .input(ruleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const errors = validateRule(input);
      if (errors.length > 0) {
        throw new ValidationError(`invalid alert rule: ${errors.join("; ")}`);
      }
      const id = await db.createAlertRule({
        userId: ctx.user.id,
        name: input.name,
        enabled: input.enabled,
        conditions: input.conditions,
        window: input.window,
        cooldownMinutes: input.cooldownMinutes,
        severity: input.severity,
        channels: input.channels,
      });
      return { id };
    }),

  updateRule: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        ...ruleInputSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getAlertRule(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("alert rule not found");
      const errors = validateRule(input);
      if (errors.length > 0) {
        throw new ValidationError(`invalid alert rule: ${errors.join("; ")}`);
      }
      await db.updateAlertRule(ctx.user.id, input.id, {
        name: input.name,
        enabled: input.enabled,
        conditions: input.conditions,
        window: input.window,
        cooldownMinutes: input.cooldownMinutes,
        severity: input.severity,
        channels: input.channels,
      });
      return { ok: true };
    }),

  setEnabled: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getAlertRule(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("alert rule not found");
      await db.updateAlertRule(ctx.user.id, input.id, { enabled: input.enabled });
      return { ok: true };
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteAlertRule(ctx.user.id, input.id);
      return { ok: true };
    }),

  listEvents: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db.listAlertEvents(ctx.user.id, input?.limit ?? 100);
      return rows.map(r => ({
        id: r.id,
        ruleId: r.ruleId,
        severity: r.severity,
        summary: r.summary,
        matched: r.matched,
        snapshots: r.snapshots,
        channel: r.channel,
        delivered: r.delivered,
        statusCode: r.statusCode,
        errorMessage: r.errorMessage,
        firedAt: r.firedAt.toISOString(),
      }));
    }),

  dryRun: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        values: z.record(metricEnum, z.number().finite()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await db.getAlertRule(ctx.user.id, input.id);
      if (!row) throw new ValidationError("alert rule not found");
      const verdict = dryRunRule(rowToAlertRule(row), input.values);
      return { verdict };
    }),

  testDelivery: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const row = await db.getAlertRule(ctx.user.id, input.id);
      if (!row) throw new ValidationError("alert rule not found");
      const rule = rowToAlertRule(row);

      const now = new Date();
      const syntheticSnapshots: MetricSnapshot[] = rule.conditions.map(c => ({
        metric: c.metric,
        value: c.threshold + (c.operator === "lt" || c.operator === "lte" ? -1 : 1),
        observedAt: now,
        sampleNote: "synthetic test fire",
      }));
      const verdict = evaluateRule(
        { ...rule, lastFiredAt: null, enabled: true },
        syntheticSnapshots,
        now
      );

      if (!verdict.fired) {
        return { ok: false as const, reason: "evaluation_did_not_fire" };
      }
      const outcomes = await dispatchAlert({
        ruleId: rule.id,
        userId: rule.userId,
        ruleName: `[TEST] ${rule.name}`,
        severity: rule.severity,
        summary: `[TEST] ${verdict.summary}`,
        matched: verdict.matched,
        snapshots: verdict.snapshots,
        channels: rule.channels,
      });
      return { ok: true as const, outcomes };
    }),
});

const _operatorTypeCheck: AlertOperator = "gt";
void _operatorTypeCheck;
