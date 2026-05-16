/**
 * Agent Guard tRPC router.
 *
 * Provides real-time prompt injection scanning and PII detection
 * for AI traffic. Uses the multi-layer promptInjectionEngine and
 * the piiDetector from server/engines/.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import * as db from "../db";
import { detect as detectPromptInjection, detectSync, setClassifierUrl, type ThreatAssessment } from "../engines/promptInjectionEngine";
import { detectPII, type PiiAssessment } from "../engines/piiDetector";

setClassifierUrl(process.env.PROMPT_INJECTION_API_URL ?? undefined);

const promptInput = z.object({
  prompt: z.string().min(1).max(128_000),
  context: z
    .object({
      model: z.string().max(128).optional(),
      provider: z.string().max(64).optional(),
      agentId: z.string().max(64).optional(),
      sessionId: z.string().max(64).optional(),
    })
    .optional(),
});

const responseInput = z.object({
  response: z.string().min(1).max(256_000),
  sessionId: z.string().max(64).optional(),
});

const batchInput = z.object({
  prompts: z
    .array(promptInput.shape.prompt)
    .min(1)
    .max(20),
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function promptHash(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

async function writeSecurityEvent(params: {
  workspaceId: string;
  eventType: "prompt_injection" | "pii_leak" | "policy_violation" | "anomaly";
  severity: "low" | "medium" | "high" | "critical";
  threatLevel: string;
  detectedPatterns: string[];
  prompt: string;
  agentId?: string;
}): Promise<void> {
  try {
    await db.insertSecurityEvent({
      workspaceId: params.workspaceId,
      eventType: params.eventType,
      severity: params.severity,
      threatLevel: params.threatLevel,
      detectedPatterns: params.detectedPatterns,
      promptHash: promptHash(params.prompt),
      agentId: params.agentId ?? null,
    });
  } catch (err) {
    logger.error({ err, eventType: params.eventType }, "[agentGuard] failed to write security event");
  }
}

function severityFromThreatLevel(level: string): "low" | "medium" | "high" | "critical" {
  const map: Record<string, "low" | "medium" | "high" | "critical"> = {
    none: "low",
    low: "low",
    medium: "medium",
    high: "high",
    critical: "critical",
  };
  return map[level] ?? "medium";
}

// ─────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────

export const agentGuardRouter = router({
  /**
   * Scan a single prompt for injection threats.
   * Writes to security_events if threatLevel >= 'high'.
   */
  scanPrompt: protectedProcedure
    .input(promptInput)
    .mutation(async ({ input, ctx }): Promise<ThreatAssessment & { written: boolean }> {
      const assessment = await detectPromptInjection(input.prompt);

      const writeThreshold = process.env.SECURITY_EVENT_THRESHOLD ?? "high";
      const shouldWrite = threatSeverityRank(assessment.threatLevel) >= threatSeverityRank(writeThreshold);

      if (shouldWrite) {
        await writeSecurityEvent({
          workspaceId: ctx.workspace?.workspaceId ?? String(ctx.user.id),
          eventType: "prompt_injection",
          severity: severityFromThreatLevel(assessment.threatLevel),
          threatLevel: assessment.threatLevel,
          detectedPatterns: assessment.detectedPatterns,
          prompt: input.prompt,
          agentId: input.context?.agentId,
        });
      }

      logger.info(
        {
          threatLevel: assessment.threatLevel,
          confidence: assessment.confidence,
          patternCount: assessment.detectedPatterns.length,
          written: shouldWrite,
        },
        "[agentGuard] prompt scanned"
      );

      return { ...assessment, written: shouldWrite };
    }),

  /**
   * Synchronous scan (no external classifier). For gateway inline use.
   */
  scanPromptSync: protectedProcedure
    .input(promptInput)
    .query(({ input }) => {
      return detectSync(input.prompt);
    }),

  /**
   * Scan an AI response for PII leakage.
   * Writes to security_events if PII detected.
   */
  scanResponse: protectedProcedure
    .input(responseInput)
    .mutation(async ({ input, ctx }): Promise<PiiAssessment & { written: boolean }> {
      const assessment = detectPII(input.response);

      if (assessment.hasPII) {
        await writeSecurityEvent({
          workspaceId: ctx.workspace?.workspaceId ?? String(ctx.user.id),
          eventType: "pii_leak",
          severity: assessment.count > 5 ? "critical" : assessment.count > 2 ? "high" : "medium",
          threatLevel: assessment.count > 5 ? "critical" : "high",
          detectedPatterns: assessment.types,
          prompt: input.response,
          agentId: undefined,
        });
      }

      logger.info(
        { piiCount: assessment.count, piiTypes: assessment.types, written: assessment.hasPII },
        "[agentGuard] response scanned"
      );

      return { ...assessment, written: assessment.hasPII };
    }),

  /**
   * Batch scan up to 20 prompts (for import flows).
   */
  batchScan: protectedProcedure
    .input(batchInput)
    .mutation(async ({ input, ctx }): Promise<{ results: Array<ThreatAssessment & { written: boolean }> }> {
      const results = await Promise.all(
        input.prompts.map(async (prompt) => {
          const assessment = await detectPromptInjection(prompt);
          const shouldWrite = assessment.threatLevel === "high" || assessment.threatLevel === "critical";

          if (shouldWrite) {
            await writeSecurityEvent({
              workspaceId: ctx.workspace?.workspaceId ?? String(ctx.user.id),
              eventType: "prompt_injection",
              severity: severityFromThreatLevel(assessment.threatLevel),
              threatLevel: assessment.threatLevel,
              detectedPatterns: assessment.detectedPatterns,
              prompt,
              agentId: undefined,
            });
          }

          return { ...assessment, written: shouldWrite };
        })
      );

      logger.info({ scanned: results.length }, "[agentGuard] batch scan complete");
      return { results };
    }),

  /**
   * List security events for the workspace.
   */
  listEvents: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        eventType: z
          .enum(["prompt_injection", "pii_leak", "policy_violation", "anomaly"])
          .optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = ctx.workspace?.workspaceId ?? String(ctx.user.id);
      const rows = await db.listSecurityEvents(workspaceId, input);
      return { events: rows };
    }),
});

function threatSeverityRank(level: string): number {
  const ranks: Record<string, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return ranks[level] ?? 0;
}
