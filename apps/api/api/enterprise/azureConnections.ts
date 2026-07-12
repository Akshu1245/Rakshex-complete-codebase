import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../../_core/trpc";
import * as db from "../../db";
import { azureConnections } from "@rakshex/database/schema-enterprise";
import { eq, and } from "drizzle-orm";
import { testAzureConnection } from "../../services/azure";
import { encryptSecret } from "../../services/vault";
import {
  requireEnterpriseRead,
  requireEnterpriseWrite,
  assertWorkspaceMatch,
} from "./workspaceAuth";

const wsInput = z.object({ workspaceId: z.number() });
const noDb = () => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
};

export const enterpriseAzureRouter = router({
  list: protectedProcedure.input(wsInput).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) noDb();
    return d!
      .select()
      .from(azureConnections)
      .where(eq(azureConnections.workspaceId, input.workspaceId));
  }),

  create: editorProcedure
    .input(
      wsInput.extend({
        tenantId: z.string().min(1),
        subscriptionId: z.string().min(1),
        displayName: z.string().optional(),
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const test = await testAzureConnection(input.tenantId, input.subscriptionId);
      if (!test.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Azure connection failed: ${test.error}`,
        });
      }
      const d = await db.getDb();
      if (!d) noDb();
      const tenantScope = `ws-${input.workspaceId}`;
      const [result] = await d!
        .insert(azureConnections)
        .values({
          workspaceId: input.workspaceId,
          tenantId: input.tenantId,
          subscriptionId: input.subscriptionId,
          displayName: input.displayName,
          encryptedClientId: encryptSecret(input.clientId, tenantScope),
          encryptedClientSecret: encryptSecret(input.clientSecret, tenantScope),
          authType: "client_secret",
          isActive: true,
        })
        .returning();
      return result;
    }),

  delete: editorProcedure
    .input(wsInput.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const d = await db.getDb();
      if (!d) noDb();
      const [existing] = await d!
        .select()
        .from(azureConnections)
        .where(
          and(
            eq(azureConnections.id, input.id),
            eq(azureConnections.workspaceId, input.workspaceId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      await d!
        .delete(azureConnections)
        .where(
          and(
            eq(azureConnections.id, input.id),
            eq(azureConnections.workspaceId, input.workspaceId),
          ),
        );
      return { success: true };
    }),

  test: protectedProcedure
    .input(
      wsInput.extend({
        tenantId: z.string().min(1),
        subscriptionId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseRead(input.workspaceId, ctx.user.id);
      return testAzureConnection(input.tenantId, input.subscriptionId);
    }),
});
