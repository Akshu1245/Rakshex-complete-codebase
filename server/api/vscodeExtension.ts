/**
 * VS Code Extension API Router
 * Provides endpoints for the Rakshex VS Code extension
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { toNumber } from "../utils/decimal";
import { rateLimitSlidingWindow } from "../_core/cache";

// VS Code activity rate limit — 60 events per rolling 60s window per
// user. Backed by a Redis sorted-set (see `rateLimitSlidingWindow`) so
// the limit is enforced consistently across every API instance, not
// just the one that happens to receive the request.
const ACTIVITY_LIMIT = 60;
const ACTIVITY_WINDOW_MS = 60_000;

export const vscodeExtensionRouter = router({
  /**
   * Validate an API key for VS Code extension authentication
   */
  validateApiKey: publicProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(async ({ input }) => {
      // Check if API key exists and is valid
      const user = await db.getUserByApiKey(input.apiKey);

      if (!user) {
        return { valid: false, user: null };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
      };
    }),

  /**
   * Record activity from VS Code extension
   */
  recordActivity: protectedProcedure
    .input(
      z.object({
        type: z.enum(["heartbeat", "file_change", "session_start", "session_end"]),
        data: z.record(z.string(), z.any()),
        timestamp: z.string().datetime(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Per-user 60-events-per-minute rate limit, distributed via Redis.
      const { allowed } = await rateLimitSlidingWindow(
        `ratelimit:vscode-activity:${ctx.user.id}`,
        ACTIVITY_LIMIT,
        ACTIVITY_WINDOW_MS,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Activity rate limit exceeded. Max ${ACTIVITY_LIMIT} events per minute.`,
        });
      }

      // Store activity in database
      await db.recordVSCodeActivity(ctx.user.id, input.type, input.data, new Date(input.timestamp));
      return { success: true };
    }),

  /**
   * Get user dashboard data for VS Code extension
   */
  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    const [collections, recentScans, tokenUsage] = await Promise.all([
      db.getCollectionsByUserId(ctx.user.id),
      db.getRecentScansForUser(ctx.user.id, 5),
      db.getTokenUsageByUserId(ctx.user.id, 7),
    ]);

    const totalFindings = recentScans.reduce((sum, scan) => sum + (scan.totalFindings || 0), 0);
    const openFindings = await db.getOpenFindingsCount(ctx.user.id);
    const weeklyCost = tokenUsage.reduce((sum, u) => sum + toNumber(u.costUSD), 0);

    return {
      collections: collections.length,
      recentScans: recentScans.length,
      totalFindings,
      openFindings,
      weeklyCost,
      lastScanAt: recentScans[0]?.createdAt ?? null,
    };
  }),

  /**
   * Get scan summary for a collection
   */
  getScanSummary: protectedProcedure
    .input(z.object({ collectionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      const scans = await db.getScansByCollectionId(input.collectionId);
      const lastScan = scans[0];

      if (!lastScan) {
        return {
          hasScans: false,
          lastScan: null,
          totalFindings: 0,
          criticalFindings: 0,
        };
      }

      const findings = await db.getFindingsByScanId(lastScan.id);
      const criticalFindings = findings.filter(
        (f) => f.severity === "Critical" || f.severity === "High",
      );

      return {
        hasScans: true,
        lastScan: {
          id: lastScan.id,
          status: lastScan.status,
          completedAt: lastScan.completedAt,
        },
        totalFindings: findings.length,
        criticalFindings: criticalFindings.length,
      };
    }),

  /**
   * Trigger a new scan from VS Code extension
   */
  triggerScan: protectedProcedure
    .input(z.object({ collectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      // Check user plan limits
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      if (user.plan === "free" && (user.scansRemaining ?? 0) <= 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Scan limit reached. Upgrade to Pro for unlimited scans.",
        });
      }

      // Queue a pending scan — the scanning worker will pick it up asynchronously.
      const scan = await db.createScan(
        ctx.user.id,
        input.collectionId,
        "quick",
        "pending",
        0,
        "LOW",
        0,
      );

      // Decrement free user scans
      if (user.plan === "free") {
        await db.updateUser(ctx.user.id, {
          scansRemaining: Math.max(0, (user.scansRemaining ?? 0) - 1),
        });
      }

      return { scanId: scan.id, status: "queued" };
    }),

  /**
   * Get recent findings for VS Code extension status bar
   */
  getRecentFindings: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(5) }))
    .query(async ({ input, ctx }) => {
      const findings = await db.getRecentFindingsForUser(ctx.user.id, input.limit);
      return findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        category: f.category,
        collectionName: f.collectionName,
      }));
    }),

  /**
   * Update finding status from VS Code
   */
  updateFindingStatus: protectedProcedure
    .input(
      z.object({
        findingId: z.string(),
        status: z.enum(["open", "in-progress", "resolved"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const finding = await db.getFindingById(input.findingId);
      if (!finding || finding.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found or access denied",
        });
      }

      await db.updateFindingStatus(input.findingId, input.status);
      return { success: true };
    }),

  /**
   * Copilot ask endpoint for VS Code extension
   */
  copilotAsk: protectedProcedure
    .input(
      z.object({ question: z.string().min(1).max(2000), context: z.string().max(500).optional() }),
    )
    .mutation(async ({ input, ctx }) => {
      // Try to use the copilot service if available
      try {
        const { answerForTenant } = await import("../services/copilot");
        const answer = await answerForTenant(ctx.user.id, input.question);
        return { response: answer.text };
      } catch {
        // Fallback if copilot service is unavailable
        return { response: generateCopilotFallback(input.question) };
      }
    }),

  /**
   * Generate API key for VS Code extension
   */
  generateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const apiKey = `dp_${generateSecureApiKey()}`;
    await db.updateUserApiKey(ctx.user.id, apiKey);
    return { apiKey };
  }),

  /**
   * Get extension settings for user
   */
  getExtensionSettings: protectedProcedure.query(async () => {
    return {
      trackingEnabled: true, // Could be stored in user preferences
      heartbeatInterval: 120,
      trackFiles: true,
      trackGit: true,
      excludePatterns: ["node_modules/**", ".git/**", "dist/**", "build/**"],
    };
  }),
});

// Helper function to generate cryptographically secure API key
function generateSecureApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Fallback copilot response when the copilot service is unavailable.
 */
function generateCopilotFallback(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("sql") || q.includes("injection")) {
    return "SQL injection vulnerabilities occur when user input is concatenated into SQL queries. Remediation: Use parameterized queries (prepared statements) for all database interactions. Never concatenate user input into SQL strings.";
  }
  if (q.includes("xss") || q.includes("cross-site")) {
    return "Cross-Site Scripting (XSS) occurs when untrusted data is rendered in HTML without proper escaping. Remediation: Always HTML-encode user input before rendering, use Content Security Policy headers, and consider using a sanitization library for rich content.";
  }
  if (q.includes("auth") || q.includes("authentication")) {
    return "Authentication vulnerabilities often stem from weak password policies, missing MFA, or improper session management. Remediation: Enforce strong passwords, implement multi-factor authentication, use secure session cookies with HttpOnly/Secure flags, and implement account lockout after failed attempts.";
  }
  return "I'm your Rakshex Security Copilot. I can help explain findings, suggest fixes, and review your security posture. For detailed analysis, ensure your Rakshex workspace has recent scan data available.";
}
