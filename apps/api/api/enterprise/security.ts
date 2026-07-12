import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../../_core/trpc";
import * as db from "../../db";
import {
  keyRiskAssessments,
  shadowKeys,
  agentGuardPolicies,
  agentGuardEvents,
  keyRotationRequests,
  azureDiscoveredKeys,
} from "@rakshex/database/schema-enterprise";
import { eq, desc, and } from "drizzle-orm";
import { evaluateRisk } from "../../services/agentguard/engine";
import { executeRotation } from "../../services/rotation/engine";
import {
  requireEnterpriseRead,
  requireEnterpriseWrite,
  assertWorkspaceMatch,
} from "./workspaceAuth";

const ws = z.object({ workspaceId: z.number() });
const noDb = () => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
};

// ─── Over-Privileged ────────────────────────────────────────────────
export const enterpriseOverprivilegedRouter = router({
  list: protectedProcedure
    .input(ws.extend({ status: z.string().optional(), severity: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await requireEnterpriseRead(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) return [];
      const rows = await d!
        .select()
        .from(keyRiskAssessments)
        .where(eq(keyRiskAssessments.workspaceId, input.workspaceId));
      let f = rows;
      if (input.status) f = f.filter((r) => r.status === input.status);
      if (input.severity) f = f.filter((r) => r.severity === input.severity);
      return f
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100);
    }),

  acknowledge: editorProcedure
    .input(ws.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const [row] = await d!
        .select()
        .from(keyRiskAssessments)
        .where(eq(keyRiskAssessments.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
      assertWorkspaceMatch(row.workspaceId, input.workspaceId);
      await d!
        .update(keyRiskAssessments)
        .set({ status: "acknowledged", acknowledgedAt: new Date() })
        .where(eq(keyRiskAssessments.id, input.id));
      return { success: true };
    }),

  resolve: editorProcedure.input(ws.extend({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) noDb();
    const [row] = await d!
      .select()
      .from(keyRiskAssessments)
      .where(eq(keyRiskAssessments.id, input.id))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
    assertWorkspaceMatch(row.workspaceId, input.workspaceId);
    await d!
      .update(keyRiskAssessments)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(keyRiskAssessments.id, input.id));
    return { success: true };
  }),
});

// ─── Shadow Keys ───────────────────────────────────────────────────
export const enterpriseShadowKeysRouter = router({
  list: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(shadowKeys)
      .where(eq(shadowKeys.workspaceId, input.workspaceId))
      .orderBy(desc(shadowKeys.createdAt))
      .limit(100);
  }),
});

// ─── AgentGuard ────────────────────────────────────────────────────
export const enterpriseAgentGuardRouter = router({
  listPolicies: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(agentGuardPolicies)
      .where(eq(agentGuardPolicies.workspaceId, input.workspaceId));
  }),

  createPolicy: editorProcedure
    .input(
      ws.extend({
        name: z.string().min(1).max(128),
        description: z.string().max(500).optional(),
        triggers: z.array(z.object({ event: z.string(), severity: z.string() })).min(1),
        action: z.enum(["revoke", "rotate", "alert_only", "disable"]),
        conditions: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const [result] = await d!
        .insert(agentGuardPolicies)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          triggers: input.triggers as { event: string; severity: string }[],
          action: input.action,
          conditions: (input.conditions ?? {}) as Record<string, unknown>,
          isEnabled: true,
          createdBy: ctx.user.id,
        })
        .returning();
      return result;
    }),

  togglePolicy: editorProcedure
    .input(ws.extend({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const [policy] = await d!
        .select()
        .from(agentGuardPolicies)
        .where(eq(agentGuardPolicies.id, input.id))
        .limit(1);
      if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "Policy not found" });
      assertWorkspaceMatch(policy.workspaceId, input.workspaceId);
      await d!
        .update(agentGuardPolicies)
        .set({ isEnabled: input.enabled })
        .where(eq(agentGuardPolicies.id, input.id));
      return { success: true };
    }),

  listEvents: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(agentGuardEvents)
      .where(eq(agentGuardEvents.workspaceId, input.workspaceId))
      .orderBy(desc(agentGuardEvents.executedAt))
      .limit(50);
  }),

  manualTrigger: editorProcedure
    .input(ws.extend({ keyId: z.number(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const key = (
        await d!
          .select()
          .from(azureDiscoveredKeys)
          .where(
            and(
              eq(azureDiscoveredKeys.id, input.keyId),
              eq(azureDiscoveredKeys.workspaceId, input.workspaceId),
            ),
          )
          .limit(1)
      )[0];
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
      return evaluateRisk(input.workspaceId, {
        type: "leak_detected",
        severity: "critical",
        keyId: key.id,
        keyName: key.keyName,
        resourceName: key.resourceName,
        description: `Manual trigger: ${input.reason}`,
      });
    }),
});

// ─── Key Rotation ──────────────────────────────────────────────────
export const enterpriseKeyRotationRouter = router({
  list: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(keyRotationRequests)
      .where(eq(keyRotationRequests.workspaceId, input.workspaceId))
      .orderBy(desc(keyRotationRequests.createdAt))
      .limit(50);
  }),

  requestRotation: editorProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        discoveredKeyId: z.number(),
        reason: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const key = (
        await d!
          .select()
          .from(azureDiscoveredKeys)
          .where(
            and(
              eq(azureDiscoveredKeys.id, input.discoveredKeyId),
              eq(azureDiscoveredKeys.workspaceId, input.workspaceId),
            ),
          )
          .limit(1)
      )[0];
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
      const id = `rot_${Date.now()}_${input.workspaceId}`;
      await d!.insert(keyRotationRequests).values({
        id,
        workspaceId: input.workspaceId,
        discoveredKeyId: input.discoveredKeyId,
        keyName: key.keyName,
        keyType: key.keyType ?? "secret",
        provider: "azure",
        reason: input.reason,
        status: "pending",
        requestedBy: ctx.user.id,
      });
      return { id };
    }),

  approve: editorProcedure.input(ws.extend({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) noDb();
    const req = (
      await d!
        .select()
        .from(keyRotationRequests)
        .where(
          and(
            eq(keyRotationRequests.id, input.id),
            eq(keyRotationRequests.workspaceId, input.workspaceId),
          ),
        )
        .limit(1)
    )[0];
    if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Rotation request not found" });
    if (req.status !== "pending") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Request is already ${req.status}` });
    }
    await d!
      .update(keyRotationRequests)
      .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
      .where(
        and(
          eq(keyRotationRequests.id, input.id),
          eq(keyRotationRequests.workspaceId, input.workspaceId),
        ),
      );
    executeRotation(input.id).catch(() => {});
    return { success: true };
  }),

  reject: editorProcedure.input(ws.extend({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) noDb();
    const req = (
      await d!
        .select()
        .from(keyRotationRequests)
        .where(eq(keyRotationRequests.id, input.id))
        .limit(1)
    )[0];
    if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Rotation request not found" });
    assertWorkspaceMatch(req.workspaceId, input.workspaceId);
    await d!
      .update(keyRotationRequests)
      .set({ status: "rejected" })
      .where(eq(keyRotationRequests.id, input.id));
    return { success: true };
  }),
});
