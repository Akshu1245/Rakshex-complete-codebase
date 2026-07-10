import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../../_core/trpc";
import * as db from "../../db";
import {
  discoveryRuns,
  azureDiscoveredKeys,
  azureConnections,
} from "../../../drizzle/schema-enterprise";
import { eq, desc, and } from "drizzle-orm";
import { runAzureDiscovery } from "../../services/discovery/orchestrator";
import { analyzeOverprivileged } from "../../services/analysis/overprivilegedDetector";
import { detectShadowKeys } from "../../services/analysis/shadowKeyDetector";
import { requireEnterpriseRead, requireEnterpriseWrite } from "./workspaceAuth";

const ws = z.object({ workspaceId: z.number() });
const noDb = () => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
};

export const enterpriseDiscoveryRouter = router({
  triggerFullDiscovery: editorProcedure
    .input(ws.extend({ connectionId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const connections = input.connectionId
        ? [
            (
              await d!
                .select()
                .from(azureConnections)
                .where(
                  and(
                    eq(azureConnections.id, input.connectionId),
                    eq(azureConnections.workspaceId, input.workspaceId),
                  ),
                )
                .limit(1)
            )[0],
          ].filter(Boolean)
        : await d!
            .select()
            .from(azureConnections)
            .where(eq(azureConnections.workspaceId, input.workspaceId));

      if (connections.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Azure connections configured. Add one first.",
        });
      }
      for (const conn of connections) {
        if (conn.workspaceId !== input.workspaceId) continue;
        runAzureDiscovery({
          workspaceId: input.workspaceId,
          connectionId: conn.id,
          tenantId: conn.tenantId,
          subscriptionId: conn.subscriptionId,
        }).catch(() => {});
      }
      return {
        message: `Discovery started for ${connections.length} connection(s)`,
        connectionCount: connections.length,
      };
    }),

  triggerRiskAnalysis: editorProcedure.input(ws).mutation(async ({ input, ctx }) => {
    await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
    const opFindings = await analyzeOverprivileged(input.workspaceId);
    await detectShadowKeys(input.workspaceId);
    return { overprivilegedFindings: opFindings.length, shadowKeyAnalysis: true };
  }),

  listRuns: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.workspaceId, input.workspaceId))
      .orderBy(desc(discoveryRuns.startedAt))
      .limit(20);
  }),

  listDiscoveredKeys: protectedProcedure
    .input(ws.extend({ resourceType: z.string().optional(), status: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await requireEnterpriseRead(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) return [];
      const keys = await d!
        .select()
        .from(azureDiscoveredKeys)
        .where(eq(azureDiscoveredKeys.workspaceId, input.workspaceId));
      let filtered = keys;
      if (input.resourceType)
        filtered = filtered.filter((k) => k.resourceType === input.resourceType);
      if (input.status) filtered = filtered.filter((k) => k.status === input.status);
      return filtered
        .sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
        .slice(0, 200);
    }),

  getKeyStats: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d)
      return { total: 0, byType: {} as Record<string, number>, active: 0, expired: 0, revoked: 0 };
    const keys = await d!
      .select()
      .from(azureDiscoveredKeys)
      .where(eq(azureDiscoveredKeys.workspaceId, input.workspaceId));
    const byType: Record<string, number> = {};
    let active = 0,
      expired = 0,
      revoked = 0;
    for (const k of keys) {
      byType[k.resourceType] = (byType[k.resourceType] ?? 0) + 1;
      if (k.status === "active") active++;
      else if (k.status === "expired") expired++;
      else if (k.status === "revoked" || k.status === "disabled") revoked++;
    }
    return { total: keys.length, byType, active, expired, revoked };
  }),
});
