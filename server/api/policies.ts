/**
 * Tenant policy router — author / list / validate / apply YAML policies.
 *
 * The router is intentionally thin: business logic lives in
 * `services/policyDsl` (parser + compiler) and `services/policyTemplates`
 * (built-in templates). Persistence is via the `tenant_policies` table
 * which stores both the YAML source and the compiled JSON form so the
 * gateway can apply policies without re-parsing on every request.
 */

import { z } from "zod";

import * as db from "../db";
import { sql } from "drizzle-orm";
import { ValidationError } from "../_core/errors";
import { protectedProcedure, router } from "../_core/trpc";
import { PolicyValidationException, compilePolicy, parsePolicy } from "../services/policyDsl";
import { POLICY_TEMPLATES, getPolicyTemplate } from "../services/policyTemplates";

const yamlInput = z
  .string()
  .min(1)
  .max(64 * 1024);

export const policiesRouter = router({
  /** List the bundled templates (id / name / description / yaml). */
  listTemplates: protectedProcedure.query(() => {
    return {
      templates: POLICY_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        yaml: t.yaml,
      })),
    };
  }),

  /** Fetch a single template by id (returns null if unknown). */
  getTemplate: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .query(({ input }) => {
      return { template: getPolicyTemplate(input.id) ?? null };
    }),

  /**
   * Validate a YAML policy without persisting it. Returns the compiled
   * shape on success; returns a structured error array on failure so
   * the dashboard can highlight individual fields.
   */
  validate: protectedProcedure.input(z.object({ yaml: yamlInput })).mutation(({ input }) => {
    try {
      const policy = parsePolicy(input.yaml);
      const compiled = compilePolicy(policy);
      return { ok: true as const, compiled };
    } catch (err) {
      if (err instanceof PolicyValidationException) {
        return { ok: false as const, errors: err.errors };
      }
      throw err;
    }
  }),

  /** List the tenant's persisted policies. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.listTenantPolicies(ctx.user.id);
    return {
      policies: rows.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        appliesTo: r.appliesTo,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }),

  /** Fetch one policy with full YAML + compiled JSON. */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const row = await db.getTenantPolicy(ctx.user.id, input.id);
      if (!row) throw new ValidationError("policy not found");
      return {
        id: row.id,
        name: row.name,
        yaml: row.yaml,
        compiled: row.compiled,
        enabled: row.enabled,
        appliesTo: row.appliesTo,
      };
    }),

  /**
   * Persist a new policy. The YAML is parsed + compiled before insert so
   * we never store an invalid document.
   */
  create: protectedProcedure
    .input(z.object({ yaml: yamlInput }))
    .mutation(async ({ ctx, input }) => {
      let parsed;
      try {
        parsed = parsePolicy(input.yaml);
      } catch (err) {
        if (err instanceof PolicyValidationException) {
          throw new ValidationError(
            `policy invalid: ${err.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
          );
        }
        throw err;
      }
      const compiled = compilePolicy(parsed);
      const id = await db.createTenantPolicy({
        userId: ctx.user.id,
        name: parsed.name,
        yaml: input.yaml,
        compiled,
        enabled: true,
        appliesTo: parsed.appliesTo[0] ?? "all",
      });
      return { id, compiled };
    }),

  /** Replace a policy with new YAML (re-parsed + re-compiled). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        yaml: yamlInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getTenantPolicy(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("policy not found");
      let parsed;
      try {
        parsed = parsePolicy(input.yaml);
      } catch (err) {
        if (err instanceof PolicyValidationException) {
          throw new ValidationError(
            `policy invalid: ${err.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
          );
        }
        throw err;
      }
      const compiled = compilePolicy(parsed);
      await db.updateTenantPolicy(ctx.user.id, input.id, {
        name: parsed.name,
        yaml: input.yaml,
        compiled,
        appliesTo: parsed.appliesTo[0] ?? "all",
      });
      return { ok: true, compiled };
    }),

  /** Toggle the `enabled` flag without rewriting the YAML body. */
  setEnabled: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getTenantPolicy(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("policy not found");
      await db.updateTenantPolicy(ctx.user.id, input.id, {
        enabled: input.enabled,
      });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteTenantPolicy(ctx.user.id, input.id);
      return { ok: true };
    }),
});

import { invalidatePolicyCache } from "../services/policyCache";
import { evaluatePolicy, type AIEventContext } from "../engines/policyEngine";
import crypto from "crypto";

export const policyRulesRouter = router({
  /** List rules for the workspace */
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const dbClient = await db.getDb();
    if (!dbClient) return { rules: [] };
    const rows = await dbClient.execute(
      sql`SELECT rule_id, name, priority, enabled, conditions, action, description FROM policy_rules WHERE workspace_id = ${`ws_${ctx.user.id}`} AND deleted_at IS NULL ORDER BY priority`,
    );
    return {
      rules: (rows as unknown as any[]).map((r: any) => ({
        ruleId: r.rule_id,
        name: r.name,
        priority: r.priority,
        enabled: r.enabled,
        conditions: typeof r.conditions === "string" ? JSON.parse(r.conditions) : r.conditions,
        action: r.action,
        description: r.description,
      })),
    };
  }),

  /** Create a new rule */
  createRule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        priority: z.number().int().min(0),
        conditions: z.object({
          operator: z.enum(["AND", "OR"]),
          rules: z.array(
            z.object({
              field: z.string(),
              op: z.enum([
                "eq",
                "in",
                "not_in",
                "gt",
                "lt",
                "gte",
                "lte",
                "regex",
                "keyword",
                "between",
              ]),
              value: z.union([
                z.string(),
                z.array(z.string()),
                z.number(),
                z.tuple([z.number(), z.number()]),
              ]),
            }),
          ),
        }),
        action: z.enum(["allow", "block", "redact", "alert_only", "require_approval"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient) throw new Error("DB unavailable");

      const ruleId = `rule_${crypto.randomBytes(8).toString("hex")}`;
      await dbClient.execute(
        sql`INSERT INTO policy_rules (rule_id, workspace_id, name, description, priority, conditions, action) VALUES (${ruleId}, ${`ws_${ctx.user.id}`}, ${input.name}, ${input.description ?? null}, ${input.priority}, ${JSON.stringify(input.conditions)}, ${input.action})`,
      );
      await invalidatePolicyCache(`ws_${ctx.user.id}`);
      return { ruleId };
    }),

  /** Update a rule */
  updateRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        priority: z.number().int().min(0).optional(),
        conditions: z
          .object({
            operator: z.enum(["AND", "OR"]),
            rules: z.array(
              z.object({
                field: z.string(),
                op: z.enum([
                  "eq",
                  "in",
                  "not_in",
                  "gt",
                  "lt",
                  "gte",
                  "lte",
                  "regex",
                  "keyword",
                  "between",
                ]),
                value: z.union([
                  z.string(),
                  z.array(z.string()),
                  z.number(),
                  z.tuple([z.number(), z.number()]),
                ]),
              }),
            ),
          })
          .optional(),
        action: z.enum(["allow", "block", "redact", "alert_only", "require_approval"]).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient) throw new ValidationError("DB unavailable");

      const sets: string[] = [];
      if (input.name !== undefined) sets.push(`name = '${input.name}'`);
      if (input.description !== undefined) sets.push(`description = '${input.description}'`);
      if (input.priority !== undefined) sets.push(`priority = ${input.priority}`);
      if (input.conditions !== undefined)
        sets.push(`conditions = '${JSON.stringify(input.conditions)}'`);
      if (input.action !== undefined) sets.push(`action = '${input.action}'`);
      if (input.enabled !== undefined) sets.push(`enabled = ${input.enabled}`);
      if (sets.length > 0) {
        await dbClient.execute(
          sql.raw(`UPDATE policy_rules SET ${sets.join(", ")} WHERE rule_id = '${input.ruleId}'`),
        );
      }
      await invalidatePolicyCache(`ws_${ctx.user.id}`);
      return { success: true };
    }),

  /** Delete a rule (soft delete) */
  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient) throw new ValidationError("DB unavailable");
      await dbClient.execute(
        sql`UPDATE policy_rules SET deleted_at = NOW(), enabled = FALSE WHERE rule_id = ${input.ruleId}`,
      );
      await invalidatePolicyCache(`ws_${ctx.user.id}`);
      return { success: true };
    }),

  /** Test a rule against a sample event (dry-run) */
  testRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        sampleEvent: z.object({
          model: z.string(),
          provider: z.string(),
          costUsd: z.number(),
          inputTokens: z.number(),
          prompt: z.string(),
          threatLevel: z.enum(["none", "low", "medium", "high", "critical"]),
          agentId: z.string(),
        }),
      }),
    )
    .query(async ({ input }) => {
      const dbClient = await db.getDb();
      if (!dbClient) return null;

      const rows = await dbClient.execute(
        sql`SELECT * FROM policy_rules WHERE rule_id = ${input.ruleId} AND deleted_at IS NULL`,
      );
      const row = (rows as unknown as any[])[0];
      if (!row) return null;

      const event: AIEventContext = {
        ...input.sampleEvent,
        timestamp: new Date(),
      };

      const rule = {
        ruleId: row.rule_id,
        name: row.name,
        priority: row.priority,
        enabled: row.enabled,
        conditions:
          typeof row.conditions === "string" ? JSON.parse(row.conditions) : row.conditions,
        action: row.action,
      };

      return evaluatePolicy(event, [rule]);
    }),

  /** Reorder rules by providing new priority values */
  reorder: protectedProcedure
    .input(
      z.object({
        ruleIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient) throw new ValidationError("DB unavailable");
      for (let i = 0; i < input.ruleIds.length; i++) {
        await dbClient.execute(
          sql`UPDATE policy_rules SET priority = ${i} WHERE rule_id = ${input.ruleIds[i]}`,
        );
      }
      await invalidatePolicyCache(`ws_${ctx.user.id}`);
      return { success: true };
    }),
});
