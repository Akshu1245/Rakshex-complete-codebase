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
import { ValidationError } from "../_core/errors";
import { protectedProcedure, router } from "../_core/trpc";
import {
  PolicyValidationException,
  compilePolicy,
  parsePolicy,
} from "../services/policyDsl";
import {
  POLICY_TEMPLATES,
  getPolicyTemplate,
} from "../services/policyTemplates";

const yamlInput = z.string().min(1).max(64 * 1024);

export const policiesRouter = router({
  /** List the bundled templates (id / name / description / yaml). */
  listTemplates: protectedProcedure.query(() => {
    return {
      templates: POLICY_TEMPLATES.map(t => ({
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
  validate: protectedProcedure
    .input(z.object({ yaml: yamlInput }))
    .mutation(({ input }) => {
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
      policies: rows.map(r => ({
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
            `policy invalid: ${err.errors.map(e => `${e.path}: ${e.message}`).join("; ")}`
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
      })
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
            `policy invalid: ${err.errors.map(e => `${e.path}: ${e.message}`).join("; ")}`
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
      })
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
