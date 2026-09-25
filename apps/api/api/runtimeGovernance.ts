/**
 * Runtime Governance tRPC router — Sprint 3.
 *
 * Aggregates the runtime-side product surfaces:
 *   - Gateway audit feed (allowed / blocked / errored requests)
 *   - Token-budget configuration + state
 *   - Shadow AI events + allowlist management
 *   - Auto-fix suggestions (open / applied / dismissed)
 *
 * Every procedure is `protectedProcedure` and scopes by `ctx.user.id` so
 * data never crosses tenants.
 */
import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { generateAndPersistAutofix } from "../services/autofix";

const SeverityEnum = z.enum(["info", "low", "medium", "high", "critical"]);
const AutofixTypeEnum = z.enum([
  "missing_pii_redaction",
  "missing_kill_switch",
  "missing_token_budget",
  "prompt_injection_unsanitized",
  "shadow_ai_call",
  "exposed_secret",
  "missing_audit_log",
  "rate_limit_missing",
]);
const LangEnum = z.enum(["node", "python", "go", "generic"]);

export const runtimeGovernanceRouter = router({
  // ── Gateway audit ─────────────────────────────────────────────────────
  recentAudit: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(1000).default(100) }))
    .query(async ({ ctx, input }) => {
      const rows = await db.getGatewayAuditRecent(ctx.user.id, input.limit);
      return { rows };
    }),

  dailyTotals: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const totals = await db.getGatewayDailyTotals(ctx.user.id, input.days);
      return { totals };
    }),

  // ── Token budget ──────────────────────────────────────────────────────
  budgetState: protectedProcedure.query(async ({ ctx }) => {
    return db.getTokenBudgetState(ctx.user.id);
  }),

  setBudget: protectedProcedure
    .input(
      z.object({
        dailyTokenLimit: z.number().int().nonnegative().nullable(),
        mode: z.enum(["soft", "hard"]).default("soft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.setTokenBudget(ctx.user.id, input.dailyTokenLimit, input.mode);
      return { ok: true };
    }),

  // ── Shadow AI ─────────────────────────────────────────────────────────
  shadowEvents: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(1000).default(100) }))
    .query(async ({ ctx, input }) => {
      return { events: await db.listShadowAiEvents(ctx.user.id, input.limit) };
    }),

  allowlist: protectedProcedure.query(async ({ ctx }) => {
    return { entries: await db.listAiAllowlist(ctx.user.id) };
  }),

  addAllowlist: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["host", "model"]),
        pattern: z.string().min(1).max(192),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.addAiAllowlistEntry(ctx.user.id, input.kind, input.pattern);
      return { ok: true };
    }),

  removeAllowlist: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.removeAiAllowlistEntry(ctx.user.id, input.id);
      return { ok: true };
    }),

  // ── Auto-fix ──────────────────────────────────────────────────────────
  listAutofix: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "applied", "dismissed"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return { suggestions: await db.listAutofix(ctx.user.id, input.status) };
    }),

  generateAutofix: protectedProcedure
    .input(
      z.object({
        findingType: AutofixTypeEnum,
        language: LangEnum.default("node"),
        findingRef: z.string().max(128).optional(),
        context: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return generateAndPersistAutofix(ctx.user.id, {
        findingType: input.findingType,
        language: input.language,
        ...(input.findingRef ? { findingRef: input.findingRef } : {}),
        ...(input.context ? { context: input.context } : {}),
      });
    }),

  updateAutofixStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["open", "applied", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateAutofixStatus(ctx.user.id, input.id, input.status);
      return { ok: true };
    }),

  // ── Auto-fix PR ──────────────────────────────────────────────────────
});
