import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { logger } from "../_core/logger";

/**
 * Derive onboarding completion from real product events, then persist.
 * Checkbox attestation alone is not enough for import/scan/invite steps.
 */
async function syncOnboardingFromEvents(userId: number) {
  const progress = await db.getOrCreateOnboardingProgress(userId);

  try {
    const [collections, teamMembers] = await Promise.all([
      db.getCollectionsByUserId(userId),
      db.getTeamMembersByUserId(userId),
    ]);

    const hasCollection = collections.length > 0;
    let hasScan = false;
    let hasFindings = false;
    let hasCompliance = false;
    if (hasCollection) {
      for (const c of collections.slice(0, 20)) {
        const scans = await db.getScansByCollectionId(c.id);
        if (scans.length > 0) {
          hasScan = true;
          const findings = await db.getFindingsByScanId(scans[0]!.id);
          if (findings.length > 0) hasFindings = true;
        }
        const reports = await db.getComplianceReportsByCollectionId(c.id);
        if (reports.length > 0) hasCompliance = true;
        if (hasScan && hasFindings && hasCompliance) break;
      }
    }
    const hasInvite = teamMembers.some(
      (m) => m.status === "pending" || m.status === "accepted" || m.memberUserId != null,
    );

    if (hasCollection && !progress.importCollectionCompleted) {
      await db.updateOnboardingStep(userId, "importCollection");
    }
    if (hasScan && !progress.runScanCompleted) {
      await db.updateOnboardingStep(userId, "runScan");
    }
    if (hasFindings && !progress.reviewFindingsCompleted) {
      await db.updateOnboardingStep(userId, "reviewFindings");
    }
    if (hasInvite && !progress.inviteTeamCompleted) {
      await db.updateOnboardingStep(userId, "inviteTeam");
    }
    if (hasCompliance && !progress.setupComplianceCompleted) {
      await db.updateOnboardingStep(userId, "setupCompliance");
    }
  } catch (err) {
    logger.warn({ err, userId }, "[Onboarding] event sync failed");
  }

  return db.getOrCreateOnboardingProgress(userId);
}

export const onboardingRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const progress = await syncOnboardingFromEvents(ctx.user.id);
    return {
      currentStep: progress.currentStep,
      importCollectionCompleted: progress.importCollectionCompleted,
      runScanCompleted: progress.runScanCompleted,
      reviewFindingsCompleted: progress.reviewFindingsCompleted,
      inviteTeamCompleted: progress.inviteTeamCompleted,
      setupComplianceCompleted: progress.setupComplianceCompleted,
      completedAt: progress.completedAt,
      /** Steps that can still be manually attested (no reliable auto-signal yet). */
      manualSteps: ["setupCompliance"] as const,
    };
  }),

  /**
   * Manual attestation — only meaningful for steps without a hard event signal
   * (e.g. setupCompliance). Import/scan/invite are auto-completed from events.
   */
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
      // Re-sync first so real events win; then allow setupCompliance attestation.
      await syncOnboardingFromEvents(ctx.user.id);
      if (input.step === "setupCompliance") {
        await db.updateOnboardingStep(ctx.user.id, input.step);
      } else {
        // For event-backed steps, only persist if evidence already exists
        // (syncOnboardingFromEvents handles detection). Callers may still
        // request this for UX refresh; we do not mark without evidence.
        const progress = await db.getOrCreateOnboardingProgress(ctx.user.id);
        const key = `${input.step}Completed` as keyof typeof progress;
        if (!progress[key]) {
          // Soft no-op: UI should deep-link to the real action instead.
          return { success: false, reason: "complete_via_product_action" as const };
        }
      }
      return { success: true };
    }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
    await syncOnboardingFromEvents(ctx.user.id);
    await db.completeOnboarding(ctx.user.id);
    return { success: true };
  }),
});
