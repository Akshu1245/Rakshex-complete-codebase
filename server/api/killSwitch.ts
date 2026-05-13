import { z } from "zod";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import * as db from "../db";
import { sendSlackKillSwitchAlert } from "../slack";
import { sendKillSwitchRecoveryEmail } from "../email";
import { deliver as deliverWebhook } from "../services/webhookDelivery";
import { toNumber, toNumberOrNull } from "../utils/decimal";
import { logger } from "../_core/logger";

export const killSwitchRouter = router({
  setBudget: editorProcedure
    .input(
      z.object({
        budgetLimitUSD: z.number().positive().max(1_000_000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.updateKillSwitchSettings(
        ctx.user.id,
        input.budgetLimitUSD,
        undefined
      );
      await db.createKillSwitchEvent(
        ctx.user.id,
        "budget_set",
        input.budgetLimitUSD,
        undefined,
        "Budget limit set by user"
      );
      return { success: true };
    }),

  trigger: protectedProcedure
    .input(z.object({ reason: z.string().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const settings = await db.getKillSwitchSettings(ctx.user.id);
      await db.updateKillSwitchSettings(ctx.user.id, undefined, true);
      await db.createKillSwitchEvent(
        ctx.user.id,
        "triggered",
        toNumberOrNull(settings?.budgetLimitUSD) ?? undefined,
        toNumberOrNull(settings?.currentSpendUSD) ?? undefined,
        input.reason
      );
      await sendSlackKillSwitchAlert({
        userId: ctx.user.id,
        userName: ctx.user.name ?? "Unknown",
        reason: input.reason,
        currentSpend: toNumber(settings?.currentSpendUSD),
        budgetLimit: toNumber(settings?.budgetLimitUSD),
      }).catch(err => logger.warn({ err: err }, "[KillSwitch] Slack alert failed"));
      // Also dispatch a kill_switch.triggered webhook for any user
      // endpoints subscribed to that event (Phase 25). Fire-and-forget.
      deliverWebhook(ctx.user.id, "kill_switch.triggered", {
        reason: input.reason,
        currentSpend: toNumber(settings?.currentSpendUSD),
        budgetLimit: toNumber(settings?.budgetLimitUSD),
        triggeredBy: "user",
      }).catch(err =>
        logger.warn({ err: err }, "[KillSwitch] webhook dispatch failed")
      );
      return { success: true };
    }),

  reset: protectedProcedure
    .input(z.object({ reason: z.string().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const settings = await db.getKillSwitchSettings(ctx.user.id);
      await db.updateKillSwitchSettings(ctx.user.id, undefined, false);
      await db.createKillSwitchEvent(
        ctx.user.id,
        "reset",
        toNumberOrNull(settings?.budgetLimitUSD) ?? undefined,
        toNumberOrNull(settings?.currentSpendUSD) ?? undefined,
        input.reason
      );

      // Send recovery email
      if (ctx.user.email) {
        await sendKillSwitchRecoveryEmail({
          toEmail: ctx.user.email,
          userName: ctx.user.name ?? "",
          resetAt: new Date().toLocaleString(),
          newBudgetLimit: toNumber(settings?.budgetLimitUSD, 100),
          dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/kill-switch`,
        }).catch(err =>
          logger.warn({ err: err }, "[KillSwitch] Recovery email failed")
        );
      }

      return { success: true };
    }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.getKillSwitchSettings(ctx.user.id);
    if (!settings) {
      await db.updateKillSwitchSettings(ctx.user.id, 100, false, 0);
      return {
        budgetLimitUSD: 100,
        isActive: false,
        currentSpendUSD: 0,
      };
    }
    return {
      budgetLimitUSD: toNumber(settings.budgetLimitUSD),
      isActive: settings.isActive,
      currentSpendUSD: toNumber(settings.currentSpendUSD),
    };
  }),

  getAuditTrail: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const events = await db.getKillSwitchAuditTrail(ctx.user.id);
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const total = events.length;
      const paginated = events.slice((page - 1) * pageSize, page * pageSize);

      return {
        events: paginated.map(e => ({
          id: e.id,
          eventType: e.eventType,
          budgetLimit: toNumberOrNull(e.budgetLimit) ?? undefined,
          currentSpend: toNumberOrNull(e.currentSpend) ?? undefined,
          reason: e.reason,
          createdAt: e.createdAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),
});
