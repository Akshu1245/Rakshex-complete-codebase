import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import * as db from "../db";
import {
  getInstallationClient,
  verifyGitHubWebhook,
  linkInstallation,
  listInstallationRepos,
} from "../services/githubApp";
import { scanQueue } from "../queues";
import type { PRScanJobData } from "../queues/workers/prScanWorker";
import { enqueueScan } from "../services/jobs";
import crypto from "crypto";

export const githubRouter = router({
  /**
   * Link a GitHub installation to the current workspace.
   */
  connectInstallation: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int(),
        accountLogin: z.string(),
        accountType: z.enum(["Organization", "User"]),
        permissions: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // TODO: resolve workspace_id from ctx when multi-tenancy is fully wired
      await linkInstallation(
        input.installationId,
        `ws_${ctx.user.id}`,
        input.accountLogin,
        input.accountType,
        input.permissions ?? {},
      );

      return { success: true, installationId: input.installationId };
    }),

  /**
   * List repositories accessible to a GitHub installation.
   */
  listRepos: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int(),
      }),
    )
    .query(async ({ input }) => {
      const repos = await listInstallationRepos(input.installationId);
      return { repos };
    }),

  /**
   * List recent scans across all collections.
   */
  listScans: protectedProcedure.query(async ({ ctx }) => {
    const collections = await db.getCollectionsByUserId(ctx.user.id);
    const allScans: any[] = [];
    for (const c of collections) {
      const scans = await db.getScansByCollectionId(c.id);
      allScans.push(...scans);
    }
    return allScans
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 50);
  }),

  getScan: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .query(async ({ input }) => {
      const scan = await db.getScanById(input.scanId);
      if (!scan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scan not found" });
      }
      return scan;
    }),

  /**
   * Request a PR scan for a specific pull request.
   */
  scanPullRequest: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int(),
        repoFullName: z.string(),
        prNumber: z.number().int(),
        headSha: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const jobData: PRScanJobData = {
        installationId: input.installationId,
        repoFullName: input.repoFullName,
        prNumber: input.prNumber,
        headSha: input.headSha,
        workspaceId: `ws_${ctx.user.id}`,
      };

      const job = await scanQueue.add("pr-scan", jobData);

      logger.info(
        { jobId: job.id, repoFullName: input.repoFullName, prNumber: input.prNumber },
        "[GitHub] PR scan queued",
      );

      return { jobId: job.id, status: "queued" };
    }),
});

/**
 * Express route handler for GitHub webhook events.
 * Verifies X-Hub-Signature-256 and enqueues PR scan jobs.
 */
export async function handleGitHubWebhook(
  payload: string,
  signature: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!verifyGitHubWebhook(payload, signature)) {
    return { status: 401, body: { error: "Invalid signature" } };
  }

  let event: {
    action?: string;
    installation?: { id: number };
    repository?: { full_name: string; name: string };
    pull_request?: {
      number: number;
      head: { sha: string; ref: string };
    };
  };

  try {
    event = JSON.parse(payload);
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const installationId = event.installation?.id;
  const repoFullName = event.repository?.full_name;
  const pr = event.pull_request;
  const action = event.action;

  // Only process PR open and sync events
  if (
    !installationId ||
    !repoFullName ||
    !pr ||
    (action !== "opened" && action !== "synchronize")
  ) {
    return { status: 200, body: { received: true, action: "skipped" } };
  }

  // Enqueue PR scan
  await scanQueue.add("pr-scan", {
    installationId,
    repoFullName,
    prNumber: pr.number,
    headSha: pr.head.sha,
    workspaceId: "unknown", // Will be resolved from installation mapping
  } as PRScanJobData);

  logger.info(
    { installationId, repoFullName, prNumber: pr.number },
    "[GitHub] Webhook received, PR scan queued",
  );

  return { status: 200, body: { received: true, action: "queued" } };
}
