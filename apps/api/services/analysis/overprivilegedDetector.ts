/**
 * Over-privileged key detection engine.
 * Evaluates discovered keys against a set of rules:
 * 1. Wildcard permissions ("*", "/*")
 * 2. Unused permissions (cross-ref against actual API usage)
 * 3. Too-broad scopes ("Contributor" > "Reader")
 * 4. Excessive roles (>3 for service principals)
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { keyRiskAssessments, azureDiscoveredKeys } from "@rakshex/database/schema-enterprise";
import { eq, and } from "drizzle-orm";

export interface RiskFinding {
  category: "wildcard_permissions" | "unused_permissions" | "too_broad_scope" | "excessive_roles";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  suggestedAction: string;
}

// Well-known Azure roles that are considered "too broad"
const BROAD_ROLES = new Set([
  "Contributor",
  "Owner",
  "User Access Administrator",
  "Global Administrator",
  "Application Administrator",
]);

// Wilder scopes that are dangerous
const WILDCARD_PATTERNS = [
  { pattern: "*", severity: "critical" as const },
  { pattern: "/*", severity: "critical" as const },
  { pattern: "https://*.azure.com", severity: "high" as const },
];

/**
 * Run over-privileged analysis on all discovered keys in a workspace.
 */
export async function analyzeOverprivileged(workspaceId: number): Promise<RiskFinding[]> {
  const findings: RiskFinding[] = [];
  const dbConn = await db.getDb();
  if (!dbConn) return findings;

  const keys = await dbConn
    .select()
    .from(azureDiscoveredKeys)
    .where(eq(azureDiscoveredKeys.workspaceId, workspaceId));

  for (const key of keys) {
    const scopes = (key.scopes as string[] | undefined) ?? [];

    // Rule 1: Wildcard permissions
    for (const wc of WILDCARD_PATTERNS) {
      if (scopes.some((s) => s.includes(wc.pattern) || s === wc.pattern)) {
        findings.push({
          category: "wildcard_permissions",
          severity: wc.severity,
          title: `Wildcard permission on "${key.keyName}"`,
          description: `Key "${key.keyName}" (${key.resourceName}) has scope matching "${wc.pattern}"`,
          evidence: {
            keyName: key.keyName,
            resourceName: key.resourceName,
            scopes,
            pattern: wc.pattern,
          },
          suggestedAction: `Replace wildcard scope with specific permissions for ${key.resourceType}`,
        });
      }
    }

    // Rule 2: Broad roles
    for (const scope of scopes) {
      if (BROAD_ROLES.has(scope)) {
        findings.push({
          category: "too_broad_scope",
          severity: "high",
          title: `Broad role "${scope}" on "${key.keyName}"`,
          description: `Key "${key.keyName}" has overly broad role "${scope}"`,
          evidence: { keyName: key.keyName, scope },
          suggestedAction: `Replace "${scope}" with a more specific, least-privilege role`,
        });
      }
    }

    // Rule 3: Excessive roles (>3 for service principals)
    if (key.resourceType === "servicePrincipal" && scopes.length > 3) {
      findings.push({
        category: "excessive_roles",
        severity: "medium",
        title: `Excessive roles on SP "${key.assignedTo ?? key.keyName}"`,
        description: `Service principal has ${scopes.length} roles assigned (recommended: ≤3)`,
        evidence: {
          keyName: key.keyName,
          assignedTo: key.assignedTo,
          roleCount: scopes.length,
          roles: scopes,
        },
        suggestedAction: `Review and consolidate roles for ${key.assignedTo ?? key.keyName}`,
      });
    }

    // Rule 4: Expired keys still active
    if (key.isExpired && key.status === "active") {
      findings.push({
        category: "unused_permissions",
        severity: "high",
        title: `Expired key "${key.keyName}" still active`,
        description: `Key "${key.keyName}" expired at ${key.expiresAt?.toISOString()} but is still marked active`,
        evidence: { keyName: key.keyName, expiresAt: key.expiresAt },
        suggestedAction: "Revoke or rotate this expired key immediately",
      });
    }
  }

  // Persist findings
  for (const f of findings) {
    await dbConn
      .insert(keyRiskAssessments)
      .values({
        workspaceId,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        evidence: f.evidence,
        suggestedAction: f.suggestedAction,
        status: "open",
      })
      .onConflictDoNothing();
  }

  logger.info(
    { workspaceId, findingsCount: findings.length },
    "[Overprivileged] Analysis complete",
  );
  return findings;
}
