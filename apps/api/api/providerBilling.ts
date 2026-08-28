import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import {
  providerBillingConnections,
  providerReconciliationWindows,
} from "@rakshex/database/schema-billing";
import { editorProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { reconcileOpenAiBilling } from "../services/billing/openAiBillingReconciliation";
import { assertWorkspacePermission } from "../services/workspaceContext";

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

async function readAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "read");
}

async function writeAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "write");
}

function noDb(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
}

export const providerBillingRouter = router({
  bindOpenAi: editorProcedure
    .input(
      workspaceInput.extend({
        providerAccountId: z.number().int().positive(),
        credentialId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) noDb();

      const [account] = await database!
        .select({ id: providerAccounts.id })
        .from(providerAccounts)
        .where(
          and(
            eq(providerAccounts.id, input.providerAccountId),
            eq(providerAccounts.workspaceId, input.workspaceId),
            eq(providerAccounts.provider, "openai"),
          ),
        )
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "OpenAI account not found" });

      const [credential] = await database!
        .select({
          id: controlPlaneCredentials.id,
          credentialType: controlPlaneCredentials.credentialType,
          status: controlPlaneCredentials.status,
        })
        .from(controlPlaneCredentials)
        .where(
          and(
            eq(controlPlaneCredentials.id, input.credentialId),
            eq(controlPlaneCredentials.workspaceId, input.workspaceId),
            eq(controlPlaneCredentials.provider, "openai"),
          ),
        )
        .limit(1);
      if (
        !credential ||
        credential.status !== "active" ||
        credential.credentialType !== "admin_readonly_api_key"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active OpenAI admin_readonly_api_key credential is required",
        });
      }

      const [binding] = await database!
        .insert(providerBillingConnections)
        .values({
          workspaceId: input.workspaceId,
          providerAccountId: input.providerAccountId,
          provider: "openai",
          billingCredentialId: input.credentialId,
        })
        .onConflictDoUpdate({
          target: [
            providerBillingConnections.workspaceId,
            providerBillingConnections.providerAccountId,
            providerBillingConnections.provider,
          ],
          set: {
            billingCredentialId: input.credentialId,
            updatedAt: new Date(),
          },
        })
        .returning({ id: providerBillingConnections.id });

      await db.createAuditLogEntry(ctx.user.id, "openai_billing_connection_bound", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        credentialId: input.credentialId,
      });
      return { id: binding?.id };
    }),

  reconcileOpenAi: editorProcedure
    .input(
      workspaceInput.extend({
        providerAccountId: z.number().int().positive(),
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const result = await reconcileOpenAiBilling({
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        start: new Date(input.start),
        end: new Date(input.end),
      });
      await db.createAuditLogEntry(ctx.user.id, "openai_billing_reconciled", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        start: input.start,
        end: input.end,
        providerBilledUsd: result.providerBilledUsd,
        gatewayAttributedUsd: result.gatewayAttributedUsd,
        driftPct: result.driftPct,
        status: result.status,
      });
      return result;
    }),

  latestOpenAi: protectedProcedure
    .input(workspaceInput.extend({ providerAccountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return null;
      const [latest] = await database
        .select()
        .from(providerReconciliationWindows)
        .where(
          and(
            eq(providerReconciliationWindows.workspaceId, input.workspaceId),
            eq(providerReconciliationWindows.providerAccountId, input.providerAccountId),
            eq(providerReconciliationWindows.provider, "openai"),
          ),
        )
        .orderBy(desc(providerReconciliationWindows.reconciledAt))
        .limit(1);
      return latest ?? null;
    }),
});
