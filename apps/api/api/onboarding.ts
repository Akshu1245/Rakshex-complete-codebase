import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const onboardingRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const progress = await db.getOrCreateOnboardingProgress(ctx.user.id);
    return {
      currentStep: progress.currentStep,
      importCollectionCompleted: progress.importCollectionCompleted,
      runScanCompleted: progress.runScanCompleted,
      reviewFindingsCompleted: progress.reviewFindingsCompleted,
      inviteTeamCompleted: progress.inviteTeamCompleted,
      setupComplianceCompleted: progress.setupComplianceCompleted,
      completedAt: progress.completedAt,
    };
  }),

  completeStep: protectedProcedure
    .input(
      z.object({
        step: z.enum([
          "importCollection",
          "runScan",
          "reviewFindings",
          "inviteTeam",
          "setupCompliance",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.updateOnboardingStep(ctx.user.id, input.step);
      return { success: true };
    }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
    await db.completeOnboarding(ctx.user.id);
    return { success: true };
  }),
});
