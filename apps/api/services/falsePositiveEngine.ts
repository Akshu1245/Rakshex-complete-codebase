/**
 * False Positive Reduction Engine
 *
 * Learns from user feedback to reduce false positives over time.
 * Tracks which findings users mark as invalid and adjusts confidence.
 */

import { logger } from "../_core/logger";
import type { EnrichedFinding } from "./scanningQuality";

interface UserFeedback {
  findingFingerprint: string;
  userId: string;
  markedAs: "valid" | "false_positive" | "ignored";
  timestamp: string;
  context?: string;
}

interface FPHistory {
  fingerprint: string;
  totalReports: number;
  falsePositiveCount: number;
  validCount: number;
  ignoredCount: number;
  lastFeedbackAt: string;
  confidenceAdjustment: number; // -100 to +100
}

// In-memory store (would be persisted to DB in production)
const fpHistory = new Map<string, FPHistory>();
const userFeedbackLog: UserFeedback[] = [];

/**
 * Record user feedback on a finding.
 */
export function recordFindingFeedback(
  fingerprint: string,
  userId: string,
  markedAs: "valid" | "false_positive" | "ignored",
  context?: string,
): void {
  const entry: UserFeedback = {
    findingFingerprint: fingerprint,
    userId,
    markedAs,
    timestamp: new Date().toISOString(),
    context,
  };
  userFeedbackLog.push(entry);

  const history = fpHistory.get(fingerprint) ?? {
    fingerprint,
    totalReports: 0,
    falsePositiveCount: 0,
    validCount: 0,
    ignoredCount: 0,
    lastFeedbackAt: entry.timestamp,
    confidenceAdjustment: 0,
  };

  history.totalReports++;
  history.lastFeedbackAt = entry.timestamp;

  if (markedAs === "false_positive") {
    history.falsePositiveCount++;
    history.confidenceAdjustment -= 15;
  } else if (markedAs === "valid") {
    history.validCount++;
    history.confidenceAdjustment += 5;
  } else if (markedAs === "ignored") {
    history.ignoredCount++;
    history.confidenceAdjustment -= 5;
  }

  // Clamp adjustment
  history.confidenceAdjustment = Math.max(-50, Math.min(50, history.confidenceAdjustment));
  fpHistory.set(fingerprint, history);

  logger.info(
    { fingerprint, markedAs, fpRate: calculateFPRate(fingerprint) },
    "[FP Engine] Feedback recorded",
  );
}

/**
 * Apply confidence adjustment based on historical feedback.
 */
export function applyHistoricalConfidence(finding: EnrichedFinding): EnrichedFinding {
  const history = fpHistory.get(finding.fingerprint);
  if (!history) return finding;

  const adjusted = Math.max(0, Math.min(100, finding.confidence + history.confidenceAdjustment));

  return {
    ...finding,
    confidence: adjusted,
    confidenceLevel: confidenceLevelFromScore(adjusted),
  };
}

/**
 * Calculate false positive rate for a finding type.
 */
export function calculateFPRate(fingerprint: string): number {
  const history = fpHistory.get(fingerprint);
  if (!history || history.totalReports < 3) return 0;
  return history.falsePositiveCount / history.totalReports;
}

/**
 * Get globally weak rules (high FP rate across users).
 */
export function getWeakRules(threshold = 0.3): Array<{ fingerprint: string; fpRate: number }> {
  const weak: Array<{ fingerprint: string; fpRate: number }> = [];
  for (const [fp, history] of fpHistory) {
    if (history.totalReports >= 5) {
      const fpRate = history.falsePositiveCount / history.totalReports;
      if (fpRate >= threshold) {
        weak.push({ fingerprint: fp, fpRate });
      }
    }
  }
  return weak.sort((a, b) => b.fpRate - a.fpRate);
}

/**
 * Suppress findings that have been marked as false positive by this user.
 */
export function shouldSuppressFinding(fingerprint: string, userId: string): boolean {
  // If user has explicitly marked this fingerprint as FP, suppress it
  const userMarked = userFeedbackLog.some(
    (f) =>
      f.findingFingerprint === fingerprint &&
      f.userId === userId &&
      f.markedAs === "false_positive",
  );
  return userMarked;
}

/**
 * Get statistics for reporting.
 */
export function getFPStats(): {
  totalFeedback: number;
  fpRate: number;
  weakRules: number;
  topFalsePositives: Array<{ fingerprint: string; fpRate: number }>;
} {
  const totalFP = userFeedbackLog.filter((f) => f.markedAs === "false_positive").length;
  const total = userFeedbackLog.length;
  const weak = getWeakRules();

  return {
    totalFeedback: total,
    fpRate: total > 0 ? totalFP / total : 0,
    weakRules: weak.length,
    topFalsePositives: weak.slice(0, 10),
  };
}

function confidenceLevelFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}
