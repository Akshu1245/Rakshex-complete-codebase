/**
 * Team AI governance tRPC router — wraps services/teamGovernance.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { assertWorkspacePermission } from "../services/workspaceContext";
import { PermissionDeniedError, type RbacAction, type RbacResource } from "../services/rbac";
import * as gov from "../services/teamGovernance";
import type { GovernanceProvider } from "../services/teamGovernance/types";
import {
  assertSeatAvailable,
  countReservedSeats,
  effectiveSeatLimit,
  getWorkspaceEntitlement,
} from "../db/workspaceSeats";
import { seatLimitError } from "../utils/planLimits";
import type { PlanType } from "../payments";

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

function planFromEntitlement(plan: string | undefined): PlanType {
  if (plan === "pro" || plan === "enterprise") return plan;
  return "free";
}

/** Map RBAC denials to FORBIDDEN so clients never see a 500 for auth failures. */
async function requireGovAccess(
  workspaceId: number,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
) {
  try {
    return await assertWorkspacePermission(workspaceId, userId, resource, action);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Workspace access denied",
      });
    }
    throw err;
  }
}

export const teamGovernanceRouter = router({
  summary: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "audit", "read");
    return gov.governanceSummary(input.workspaceId);
  }),

  entitlements: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "billing", "read");
    const ent = await getWorkspaceEntitlement(input.workspaceId);
    const used = await countReservedSeats(input.workspaceId);
    const limit = ent ? effectiveSeatLimit(ent) : 1;
    return { entitlement: ent, seats: { used, limit, available: Math.max(0, limit - used) } };
  }),

  listIdentities: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "members", "read");
    return gov.listIdentities(input.workspaceId);
  }),

  linkIdentity: protectedProcedure
    .input(
      workspaceInput.extend({
        identityId: z.number().int().positive(),
        workspaceUserId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "members", "write");
      return gov.linkIdentityToMember(input.workspaceId, input.identityId, input.workspaceUserId);
    }),

  usageSummary: protectedProcedure
    .input(
      workspaceInput.extend({
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "audit", "read");
      const range =
        input.since || input.until
          ? {
              since: input.since ? new Date(input.since) : undefined,
              until: input.until ? new Date(input.until) : undefined,
            }
          : undefined;
      return gov.usageSummary(input.workspaceId, range);
    }),

  listBudgets: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "read");
    return gov.listBudgets(input.workspaceId);
  }),

  setBudget: protectedProcedure
    .input(
      workspaceInput.extend({
        identityId: z.number().int().positive().optional(),
        limitUsd: z.number().positive(),
        warningPct: z.number().int().min(50).max(99).default(80),
        hardLimit: z.boolean().default(false),
        enforcementMode: z
          .enum(["gateway", "provider_native", "monitor_only"])
          .default("monitor_only"),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "write");
      return gov.upsertBudget({
        workspaceId: input.workspaceId,
        identityId: input.identityId,
        limitUsd: input.limitUsd,
        warningPct: input.warningPct,
        hardLimit: input.hardLimit,
        enforcementMode: input.enforcementMode,
        metadata: input.metadata,
      });
    }),

  deleteBudget: protectedProcedure
    .input(workspaceInput.extend({ budgetId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "delete");
      return gov.deleteBudget(input.workspaceId, input.budgetId);
    }),

  evaluateGateway: protectedProcedure
    .input(
      workspaceInput.extend({
        identityId: z.number().int().positive().optional(),
        projectId: z.string().optional(),
        agentId: z.string().optional(),
        estimatedCostUsd: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "read");
      return gov.evaluateGatewayGovernance({
        workspaceId: input.workspaceId,
        identityId: input.identityId,
        projectId: input.projectId,
        agentId: input.agentId,
        estimatedCostUsd: input.estimatedCostUsd,
      });
    }),

  listKillSwitches: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "read");
    return gov.listKillSwitches(input.workspaceId);
  }),

  setKillSwitch: protectedProcedure
    .input(
      workspaceInput.extend({
        scopeType: z.enum(["workspace", "identity", "project", "agent"]),
        scopeId: z.string().min(1).max(128),
        active: z.boolean(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "write");
      const row = await gov.setKillSwitch({
        workspaceId: input.workspaceId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        active: input.active,
        reason: input.reason,
        setBy: ctx.user.id,
      });
      return {
        ok: true,
        row,
        propagation: "redis_scoped",
        note:
          input.scopeType === "workspace"
            ? "Blocked at gateway for routed traffic"
            : "Scoped control updated; direct provider traffic may continue unless routed through gateway",
      };
    }),

  listConnectors: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "read");
    return gov.capabilitiesCatalog();
  }),

  syncProvider: protectedProcedure
    .input(
      workspaceInput.extend({
        provider: z.string().min(1),
        orgName: z.string().optional(),
        providerAccountId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "policies", "write");
      return gov.syncProvider({
        workspaceId: input.workspaceId,
        provider: input.provider as GovernanceProvider,
        orgName: input.orgName,
        providerAccountId: input.providerAccountId,
      });
    }),

  providerHealth: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "provider_health", "read");
    return gov.healthStatus(input.workspaceId);
  }),

  importSeats: protectedProcedure
    .input(
      workspaceInput.extend({
        subscriptionId: z.number().int().positive(),
        seats: z.array(
          z.object({
            externalUserId: z.string().optional(),
            email: z.string().email().optional(),
            displayName: z.string().optional(),
            role: z.string().optional(),
            status: z.enum(["active", "inactive", "pending", "unknown"]).optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireGovAccess(input.workspaceId, ctx.user.id, "connectors", "write");
      return gov.importSeatsLinkIdentities({
        workspaceId: input.workspaceId,
        subscriptionId: input.subscriptionId,
        seats: input.seats,
      });
    }),

  seatCheck: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await requireGovAccess(input.workspaceId, ctx.user.id, "members", "read");
    try {
      await assertSeatAvailable(input.workspaceId);
      return { ok: true };
    } catch {
      const ent = await getWorkspaceEntitlement(input.workspaceId);
      const used = await countReservedSeats(input.workspaceId);
      const limit = ent ? effectiveSeatLimit(ent) : 1;
      throw seatLimitError(planFromEntitlement(ent?.plan), used, limit);
    }
  }),
});
