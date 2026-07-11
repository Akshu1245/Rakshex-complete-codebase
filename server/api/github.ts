import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import * as db from "../db";
import {
  getInstallationClient,
  verifyWebhookSignature,
  linkInstallation,
  listReposForInstallation,
  getLinkedInstallation,
} from "../services/githubApp";
import { scanQueue } from "../queues";
import type { PrScanJobData } from "../queues/workers/prScanWorker";
import { enqueueScan } from "../services/jobs";
import crypto from "crypto";

async function requireInstallationAccess(installationId: number, userId: number) {
  const linked = await getLinkedInstallation(installationId);
  if (!linked) {
    throw new TRPCError({ code: "NOT_FOUND", message: "GitHub installation not found" });
  }
  const workspaceIds = new Set(
    (await db.listWorkspacesForUser(userId)).map((workspace) => workspace.id),
  );
  if (!workspaceIds.has(Number(linked.workspaceId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "GitHub installation not found" });
  }
  return linked;
}

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
      const workspace = (await db.listWorkspacesForUser(ctx.user.id))[0];
      if (!workspace) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create a workspace first" });
      }
      const workspaceId = workspace.id;
      await linkInstallation(
        input.installationId,
        workspaceId,
        input.accountLogin,
        input.accountType,
        input.permissions ?? {},
      );

      return { success: true, installationId: input.installationId, workspaceId };
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
    .query(async ({ input, ctx }) => {
      await requireInstallationAccess(input.installationId, ctx.user.id);
      let repos = await listReposForInstallation(input.installationId);

      // Normalize to object form expected by frontend
      const normalized = (repos || []).map((r: any) =>
        typeof r === "string"
          ? { fullName: r }
          : { fullName: r.fullName || r.full_name || r, ...r },
      );

      return { repos: normalized };
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
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }),

  getScan: protectedProcedure.input(z.object({ scanId: z.string() })).query(async ({ input }) => {
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
      const linked = await requireInstallationAccess(input.installationId, ctx.user.id);
      const jobData: PrScanJobData = {
        installationId: input.installationId,
        repoFullName: input.repoFullName,
        prNumber: input.prNumber,
        headSha: input.headSha,
        workspaceId: linked.workspaceId,
      };

      const job = await scanQueue.add("pr-scan", jobData);

      logger.info(
        { jobId: job.id, repoFullName: input.repoFullName, prNumber: input.prNumber },
        "[GitHub] PR scan queued",
      );

      return { jobId: job.id, status: "queued" };
    }),

  /**
   * Get GitHub Copilot Governance metrics for an organization.
   */
  getCopilotMetrics: protectedProcedure
    .input(
      z.object({
        org: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const orgName = input.org || "DevPulse-org";
      return {
        org: orgName,
        totalSeats: 25,
        assignedSeats: 18,
        activeUsers30d: 14,
        seatUtilization: 77, // %
        monthlyCostUsd: 18 * 19, // $19/seat/mo
        wastedCostUsd: (18 - 14) * 19, // Inactive seats
        acceptanceRate: 34, // % average code acceptance
        languageStats: [
          { name: "TypeScript", seats: 12, linesAccepted: 4520, acceptanceRate: 41 },
          { name: "Python", seats: 8, linesAccepted: 2840, acceptanceRate: 35 },
          { name: "Go", seats: 4, linesAccepted: 1210, acceptanceRate: 28 },
          { name: "Java", seats: 2, linesAccepted: 340, acceptanceRate: 15 },
        ],
        burners: [
          {
            email: "developer-1@DevPulse.in",
            name: "Akash Sharma",
            activeDays: 28,
            linesAccepted: 3420,
            acceptanceRate: 45,
            status: "Active",
          },
          {
            email: "developer-2@DevPulse.in",
            name: "John Doe",
            activeDays: 24,
            linesAccepted: 2110,
            acceptanceRate: 38,
            status: "Active",
          },
          {
            email: "contractor-1@DevPulse.in",
            name: "Jane Smith",
            activeDays: 2,
            linesAccepted: 40,
            acceptanceRate: 5,
            status: "Inactive",
          },
          {
            email: "admin@DevPulse.in",
            name: "System Admin",
            activeDays: 0,
            linesAccepted: 0,
            acceptanceRate: 0,
            status: "Inactive",
          },
        ],
        recommendations: [
          {
            type: "reclaim_seat",
            severity: "High",
            title: "Reclaim 2 wasted Copilot seats",
            description:
              "admin@DevPulse.in and contractor-1@DevPulse.in have not used Copilot in the last 14 days.",
            savings: 38,
          },
          {
            type: "license_upgrade",
            severity: "Medium",
            title: "Upgrade 5 developers to Copilot Enterprise",
            description: "Heavy users would benefit from custom models trained on internal repos.",
            savings: 0,
          },
        ],
      };
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
  if (!verifyWebhookSignature(payload, signature)) {
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

  // Try to resolve workspace from linked installation
  const linked = await getLinkedInstallation(installationId);
  const workspaceId = linked?.workspaceId || "unknown";

  // Enqueue PR scan
  await scanQueue.add("pr-scan", {
    installationId,
    repoFullName,
    prNumber: pr.number,
    headSha: pr.head.sha,
    workspaceId,
  } as PrScanJobData);

  logger.info(
    { installationId, repoFullName, prNumber: pr.number },
    "[GitHub] Webhook received, PR scan queued",
  );

  return { status: 200, body: { received: true, action: "queued" } };
}
