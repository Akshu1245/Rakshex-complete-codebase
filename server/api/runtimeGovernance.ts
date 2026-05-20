/**
 * Runtime Governance tRPC router — Sprint 3.
 *
 * Aggregates the runtime-side product surfaces:
 *   - Gateway audit feed (allowed / blocked / errored requests)
 *   - Token-budget configuration + state
 *   - Shadow AI events + allowlist management
 *   - Continuous red-team runs + history
 *   - Auto-fix suggestions (open / applied / dismissed)
 *   - Security Copilot conversations
 *   - Cost forecast + anomaly detection
 *
 * Every procedure is `protectedProcedure` and scopes by `ctx.user.id` so
 * data never crosses tenants.
 */
import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { runRedTeam } from "../services/redTeamRunner";
import { generateAndPersistAutofix } from "../services/autofix";
import { sendCopilotMessage, startConversation } from "../services/copilot";
import { forecastForUser, forecastPerModel, computeSoftCapWarnings } from "../services/forecasting";
import { createPullRequest } from "../github";

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

  // ── Red-team ──────────────────────────────────────────────────────────
  redteamRuns: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const runs = await db.listRedteamRuns(ctx.user.id, input.limit);
      const runsWithFindings = await Promise.all(
        runs.map(async (run) => {
          const findings = await db.listRedteamFindings(run.id);
          return { ...run, findings };
        }),
      );
      return { runs: runsWithFindings };
    }),

  redteamRun: protectedProcedure
    .input(z.object({ runId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const run = await db.getRedteamRun(input.runId);
      if (!run || run.userId !== ctx.user.id) {
        return { run: null, findings: [] };
      }
      const findings = await db.listRedteamFindings(input.runId);
      return { run, findings };
    }),

  startRedteam: protectedProcedure
    .input(
      z.object({
        target: z.string().url(),
        apiKey: z.string().min(8).max(256).optional(),
        sample: z.number().int().positive().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const summary = await runRedTeam({
        userId: ctx.user.id,
        target: input.target,
        ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        ...(input.sample ? { sample: input.sample } : {}),
        triggeredBy: "manual",
      });
      return summary;
    }),

  scheduleRedteam: protectedProcedure
    .input(
      z.object({
        target: z.string().url(),
        cron: z.string().min(9).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.setRedteamSchedule(ctx.user.id, input.target, input.cron, true);
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

  applyAutofixAsPR: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        repoFullName: z.string().min(1).max(128),
        baseBranch: z.string().min(1).max(128),
        headBranch: z.string().min(1).max(128),
        githubToken: z.string().min(1).max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fix = await db.getAutofixById(ctx.user.id, input.id);
      if (!fix) {
        return { ok: false, error: "Autofix not found" };
      }

      const pr = await createPullRequest(
        {
          appId: "devpulse",
          privateKey: input.githubToken,
          installationId: "devpulse",
        },
        {
          repoFullName: input.repoFullName,
          title: fix.title,
          body: `## ${fix.title}\n\n${fix.rationale}\n\n### Suggested change\n\n\`\`\`${fix.languageHint}\n${fix.snippet}\n\`\`\`\n\n_Generated by DevPulse Auto-Fix_`,
          headBranch: input.headBranch,
          baseBranch: input.baseBranch,
        },
      );

      await db.updateAutofixStatus(ctx.user.id, input.id, "applied");
      return { ok: true, prNumber: pr.prNumber, prUrl: pr.prUrl };
    }),

  // ── Security Copilot ─────────────────────────────────────────────────
  copilotConversations: protectedProcedure.query(async ({ ctx }) => {
    return { conversations: await db.listCopilotConversations(ctx.user.id) };
  }),

  copilotMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      return { messages: await db.listCopilotMessages(input.conversationId) };
    }),

  copilotAsk: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1).max(64).optional(),
        title: z.string().max(192).optional(),
        query: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversationId = input.conversationId ?? crypto.randomUUID();
      if (!input.conversationId) {
        await startConversation(
          ctx.user.id,
          conversationId,
          input.title ?? input.query.slice(0, 64),
        );
      }
      const answer = await sendCopilotMessage(ctx.user.id, conversationId, input.query);
      return { conversationId, answer };
    }),

  // ── Auto-fix PR ──────────────────────────────────────────────────────
  applyAutofixAsPr: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        repoFullName: z.string().min(1).max(256),
        baseBranch: z.string().min(1).max(256).default("main"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fix = await db.getAutofixById(ctx.user.id, input.id);
      if (!fix) throw new Error("Autofix not found");

      const branchName = `devpulse/autofix-${fix.findingType}-${Date.now()}`;
      const body = `## DevPulse Auto-Fix: ${fix.title}\n\n${fix.rationale}\n\n### Suggested Change\n\n\`\`\`${fix.languageHint}\n${fix.snippet}\n\`\`\`\n\n_Generated by DevPulse Security Copilot_`;

      const pr = await createPullRequest(
        {
          appId: process.env.GITHUB_APP_ID || "",
          privateKey: process.env.GITHUB_APP_PRIVATE_KEY || "",
          installationId: process.env.GITHUB_APP_INSTALLATION_ID || "",
        },
        {
          repoFullName: input.repoFullName,
          title: fix.title,
          body,
          headBranch: branchName,
          baseBranch: input.baseBranch,
        },
      );

      await db.updateAutofixStatus(ctx.user.id, input.id, "applied");
      return { prNumber: pr.prNumber, prUrl: pr.prUrl };
    }),

  // ── Forecast + anomaly detection ─────────────────────────────────────
  forecast: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(7).max(180).default(30),
        horizon: z.number().int().min(1).max(60).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      return forecastForUser(ctx.user.id, input.days, input.horizon);
    }),

  forecastPerModel: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(7).max(180).default(30),
        horizon: z.number().int().min(1).max(60).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      return forecastPerModel(ctx.user.id, input.days, input.horizon);
    }),

  softCapWarnings: protectedProcedure
    .input(
      z.object({
        capUsd: z.number().min(0).default(1000),
        currentSpendUsd: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const forecast = await forecastForUser(ctx.user.id, 30, 14);
      const warnings = computeSoftCapWarnings(
        forecast.forecast,
        { _total: input.capUsd },
        input.currentSpendUsd,
      );
      return { warnings, forecast };
    }),
});
