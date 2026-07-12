import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../../_core/trpc";
import { syncCopilotMetrics, getCopilotMetrics } from "../../services/copilot/copilotMetrics";
import { requireEnterpriseRead, requireEnterpriseWrite } from "./workspaceAuth";

export const enterpriseCopilotRouter = router({
  sync: editorProcedure
    .input(z.object({ workspaceId: z.number(), orgName: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
      const token = process.env.GITHUB_COPILOT_TOKEN ?? "";
      if (!token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GITHUB_COPILOT_TOKEN env var not set",
        });
      }
      await syncCopilotMetrics(input.workspaceId, input.orgName, token);
      return { success: true, message: "Copilot metrics synced" };
    }),

  getMetrics: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireEnterpriseRead(input.workspaceId, ctx.user.id);
      return getCopilotMetrics(input.workspaceId);
    }),
});
