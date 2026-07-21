/**
 * Scan Service - Reusable scan logic for collections
 * Can be called from scanning router or GitHub webhooks
 */

import * as db from "../db";
import { NotFoundError } from "../_core/errors";
import { logger } from "../_core/logger";
import {
  generateRealFindings,
  calculateRiskScore,
  getRiskLevel,
  type CollectionData,
} from "../utils/scanning";
import { generatePromptInjectionFindings } from "../utils/promptInjectionScan";
import { sendScanCompleteEmail } from "../email";
import { sendSlackScanAlert } from "../slack";
import { deliver as deliverWebhook } from "./webhookDelivery";

export interface ScanResult {
  scanId: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  totalFindings: number;
  findings: Array<{
    id: string;
    title: string;
    severity: "Critical" | "High" | "Medium" | "Low";
    description: string;
    category: string;
    remediation: string;
    cweId: string;
    ruleId?: string;
    confidence?: string;
    fingerprint?: string;
    endpoint?: string;
    method?: string;
    evidence?: unknown;
  }>;
  /**
   * Populated when the scan was stopped early by the ScanBudget
   * diminishing-returns heuristic. Lets callers surface "we stopped early
   * because further scanning wasn't finding anything new" in the UI.
   */
  budget?: {
    stopped: boolean;
    iterationsRun: number;
    reason?: string;
  };
}

export interface ScanOptions {
  scanType: "full" | "quick" | "shadow_api" | "prompt_injection";
  triggeredBy?: "user" | "github_push" | "github_pr";
  prNumber?: number;
  branch?: string;
  commitSha?: string;
}

/**
 * Run a security scan on a collection
 * This function can be called from the API or from GitHub webhooks
 */
export async function runCollectionScan(
  userId: number,
  collectionId: string,
  options: ScanOptions,
): Promise<ScanResult> {
  const collection = await db.getCollectionById(collectionId);
  if (!collection) {
    throw new NotFoundError("Collection not found", {
      context: { collectionId, userId },
    });
  }

  // Fire scan.started webhook for any user-registered endpoints. Slack
  // integration stays on scan.complete only (parity with pre-webhook
  // behaviour); webhook subscribers get both events so they can correlate.
  try {
    await deliverWebhook(userId, "scan.started", {
      collectionId,
      collectionName: collection.name,
      scanType: options.scanType,
      triggeredBy: options.triggeredBy || "user",
    });
  } catch (err) {
    logger.warn({ err }, "[ScanService] scan.started webhook failed");
  }

  // Generate findings. Prompt-injection scans use a dedicated payload-aware
  // scanner with a scan budget; everything else goes through the original
  // heuristic pipeline so we don't change behaviour for existing flows.
  let findings: ReturnType<typeof generateRealFindings>;
  let budget: ScanResult["budget"];
  if (options.scanType === "prompt_injection") {
    const piResult = generatePromptInjectionFindings(collection.data);
    // Shape-compat: promptInjection findings carry a couple of extra fields
    // (endpoint, method, payloadId) that the generic finding pipeline
    // doesn't persist — we ignore those when writing to DB but keep them
    // in the in-memory findings list so the API caller can see them.
    findings = piResult.findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      description: f.description,
      category: f.category,
      remediation: f.remediation,
      cweId: f.cweId,
    }));
    budget = piResult.budget;
  } else {
    findings = generateRealFindings(collection.data as CollectionData);
  }
  const riskScore = calculateRiskScore(findings);
  const riskLevel = getRiskLevel(riskScore);

  const workspaceId = collection.workspaceId ?? undefined;

  // Create scan record
  const scan = await db.createScan(
    userId,
    collectionId,
    options.scanType,
    "completed",
    riskScore,
    riskLevel,
    findings.length,
    findings,
    workspaceId,
  );

  // Save individual findings with rich scanner metadata; group duplicates by fingerprint
  try {
    await db.reactivateExpiredSuppressions(userId);

    const priorOpen = await db.listFindingsForUser(userId, {
      collectionId,
      limit: 500,
    });
    const byFp = new Map(
      priorOpen.filter((f) => f.fingerprint).map((f) => [f.fingerprint as string, f]),
    );

    for (const finding of findings) {
      const fp = (finding as { fingerprint?: string }).fingerprint;
      const prior = fp ? byFp.get(fp) : undefined;
      // Active suppression with future expiry → skip re-open as open
      if (
        prior &&
        prior.status === ("suppressed" as any) &&
        prior.suppressionExpiresAt &&
        new Date(prior.suppressionExpiresAt) > new Date()
      ) {
        continue;
      }
      // Accepted risk still active → keep accepted
      const status =
        prior?.status === ("accepted_risk" as any)
          ? ("accepted_risk" as const)
          : prior && prior.status === ("false_positive" as any)
            ? ("false_positive" as const)
            : ("open" as const);

      await db.createFinding(
        scan.id,
        collectionId,
        userId,
        finding.title,
        finding.severity,
        finding.description,
        finding.category,
        finding.remediation,
        finding.cweId,
        {
          ruleId: (finding as any).ruleId,
          confidence: (finding as any).confidence,
          fingerprint: fp,
          endpoint: (finding as any).endpoint,
          method: (finding as any).method,
          evidence: (finding as any).evidence,
          workspaceId,
          status,
          duplicateOf: prior && prior.scanId !== scan.id ? prior.id : undefined,
        },
      );
    }
  } catch (err) {
    logger.error(
      { err, scanId: scan.id, totalFindings: findings.length },
      "[ScanService] findings insert failed partially — scan record preserved",
    );
  }

  // Update last scanned timestamp
  await db.updateCollectionLastScannedAt(collectionId);

  // Get user for notifications
  const user = await db.getUserById(userId);

  // Count findings by severity
  const criticalCount = findings.filter((f) => f.severity === "Critical").length;
  const highCount = findings.filter((f) => f.severity === "High").length;
  const mediumCount = findings.filter((f) => f.severity === "Medium").length;
  const lowCount = findings.filter((f) => f.severity === "Low").length;

  // Send email notification if user has email
  if (user?.email) {
    try {
      await sendScanCompleteEmail({
        toEmail: user.email,
        userName: user.name || "",
        collectionName: collection.name,
        scanDate: new Date().toISOString(),
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/collections/${collectionId}`,
      });
    } catch (error) {
      logger.warn({ err: error }, "[ScanService] Failed to send scan completion email");
    }
  }

  // Send Slack notification
  try {
    await sendSlackScanAlert({
      userId,
      userName: user?.name || "Unknown",
      collectionName: collection.name,
      scanId: scan.id,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      triggeredBy: options.triggeredBy || "user",
      prNumber: options.prNumber,
      branch: options.branch,
    });
  } catch (error) {
    logger.warn({ err: error }, "[ScanService] Failed to send Slack notification");
  }

  // Fire lifecycle webhooks (Phase 25). These run *in addition to* the
  // Slack alert so existing customers keep their Slack flow and new
  // customers get a pluggable HTTP webhook instead.
  try {
    await deliverWebhook(userId, "scan.complete", {
      scanId: scan.id,
      collectionId,
      collectionName: collection.name,
      scanType: options.scanType,
      riskScore,
      riskLevel,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      triggeredBy: options.triggeredBy || "user",
      prNumber: options.prNumber,
      branch: options.branch,
      budget,
    });
  } catch (error) {
    logger.warn({ err: error }, "[ScanService] scan.complete webhook failed");
  }

  // Per-finding webhooks for Critical & High only — we don't want to
  // spam subscribers with every Medium/Low item. Fire in parallel but
  // never fail the scan if a single one errors.
  const notable = findings.filter((f) => f.severity === "Critical" || f.severity === "High");
  if (notable.length > 0) {
    await Promise.allSettled(
      notable.map((f) =>
        deliverWebhook(userId, "finding.discovered", {
          scanId: scan.id,
          collectionId,
          collectionName: collection.name,
          findingId: f.id,
          title: f.title,
          severity: f.severity,
          category: f.category,
          cweId: f.cweId,
        }),
      ),
    );
  }

  return {
    scanId: scan.id,
    riskScore,
    riskLevel,
    totalFindings: findings.length,
    findings,
    budget,
  };
}
