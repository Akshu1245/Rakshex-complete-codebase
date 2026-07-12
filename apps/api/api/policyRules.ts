/**
 * Policy Rules tRPC router — declarative rule engine CRUD & testing.
 *
 * Uses the policy_rules table (separate from the YAML DSL tenant_policies).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import * as db from "../db";
import { evaluatePolicy, type AIEventContext, type PolicyRule } from "../engines/policyEngine";
import { invalidatePolicyCache } from "../services/policyCache";

const ruleInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(0),
  conditions: z.any(), // Validated at runtime
  action: z.enum(["allow", "block", "redact", "alert_only", "require_approval"]),
});

export const policyRulesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx }) => {
      const workspaceId = String(ctx.user.id);
      const rows = await db.listPolicyRules(workspaceId);
      return {
        rules: rows.slice(0, 100).map((r) => ({
          ruleId: r.ruleId,
          workspaceId: r.workspaceId,
          name: r.name,
          description: r.description,
          enabled: r.enabled,
          priority: r.priority,
          conditions: r.conditions,
          action: r.action,
          created_at: r.createdAt?.toISOString(),
          updated_at: r.updatedAt?.toISOString(),
        })),
      };
    }),

  create: protectedProcedure.input(ruleInputSchema).mutation(async ({ input, ctx }) => {
    const workspaceId = String(ctx.user.id);
    const ruleId = crypto.randomUUID();

    // Validate conditions shape
    const cond = input.conditions as { operator?: string; rules?: unknown[] };
    if (!cond || typeof cond !== "object" || !cond.operator || !Array.isArray(cond.rules)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid conditions: expected { operator: 'AND' | 'OR', rules: [...] }",
      });
    }

    await db.insertPolicyRule({
      ruleId,
      workspaceId,
      name: input.name,
      description: input.description,
      priority: input.priority,
      conditions: input.conditions,
      action: input.action,
    });

    await invalidatePolicyCache(workspaceId);

    logger.info({ ruleId, name: input.name }, "[policyRules] created");
    return { ruleId };
  }),

  update: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().min(1).max(64),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        enabled: z.boolean().optional(),
        priority: z.number().int().min(0).optional(),
        conditions: z.any().optional(),
        action: z.enum(["allow", "block", "redact", "alert_only", "require_approval"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const workspaceId = String(ctx.user.id);
      const existing = await db.getPolicyRule(input.ruleId);
      if (!existing || existing.workspaceId !== workspaceId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.conditions !== undefined) patch.conditions = input.conditions;
      if (input.action !== undefined) patch.action = input.action;

      await db.updatePolicyRule(input.ruleId, patch);
      await invalidatePolicyCache(workspaceId);

      logger.info({ ruleId: input.ruleId }, "[policyRules] updated");
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ ruleId: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      const workspaceId = String(ctx.user.id);
      const existing = await db.getPolicyRule(input.ruleId);
      if (!existing || existing.workspaceId !== workspaceId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      // Soft delete
      await db.updatePolicyRule(input.ruleId, {
        enabled: false,
        deleted_at: new Date().toISOString(),
      });
      await invalidatePolicyCache(workspaceId);

      logger.info({ ruleId: input.ruleId }, "[policyRules] deleted");
      return { ok: true };
    }),

  test: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().min(1).max(64),
        sampleEvent: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const workspaceId = String(ctx.user.id);
      const row = await db.getPolicyRule(input.ruleId);
      if (!row || row.workspaceId !== workspaceId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      const event: AIEventContext = {
        model: input.sampleEvent.model ?? "unknown",
        provider: input.sampleEvent.provider ?? "unknown",
        costUsd: Number(input.sampleEvent.cost_usd ?? 0),
        inputTokens: Number(input.sampleEvent.input_tokens ?? 0),
        prompt: input.sampleEvent.prompt ?? "",
        threatLevel: input.sampleEvent.threat_level ?? "none",
        agentId: input.sampleEvent.agent_id ?? "unknown",
        userId: input.sampleEvent.user_id ?? "unknown",
        toolCalls: input.sampleEvent.tool_calls ?? [],
        timestamp: new Date(input.sampleEvent.timestamp ?? Date.now()),
      };

      const rule: PolicyRule = {
        ruleId: row.ruleId,
        name: row.name,
        priority: row.priority,
        enabled: row.enabled,
        conditions: row.conditions as PolicyRule["conditions"],
        action: row.action,
      };

      const decision = evaluatePolicy(event, [rule]);
      return { decision };
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        ruleIds: z.array(z.string().min(1).max(64)).min(1).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const workspaceId = String(ctx.user.id);
      for (let i = 0; i < input.ruleIds.length; i++) {
        await db.updatePolicyRule(input.ruleIds[i], { priority: i });
      }
      await invalidatePolicyCache(workspaceId);
      return { ok: true };
    }),
});
