/**
 * Shadow key detection engine.
 * Cross-references keys found in code (existing secret scanner) against keys in Azure Key Vault.
 * Keys in code that don't exist in any connected vault are "shadow keys."
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import {
  azureDiscoveredKeys,
  controlPlaneCredentials,
  shadowKeys,
} from "@rakshex/database/schema-enterprise";
import { collections, findings } from "@rakshex/database";
import { eq, and, sql } from "drizzle-orm";
import { sha256 } from "../../utils/crypto";
import { getVault } from "../vault";

/**
 * Run shadow key analysis for a workspace.
 * Checks findings from existing secret scanner against discovered Key Vault keys.
 *
 * Exact matching is possible only against centrally registered credential
 * fingerprints. Azure inventory stores resource/name fingerprints because Key
 * Vault listing does not expose secret values; treating those as value hashes
 * would create false matches. Raw secrets are hashed in memory and never stored.
 */
export async function detectShadowKeys(workspaceId: number): Promise<{
  analyzed: number;
  shadow: number;
  managed: number;
}> {
  const dbConn = await db.getDb();
  if (!dbConn) throw new Error("Database unavailable");

  const [credentials, vaults, results] = await Promise.all([
    dbConn
      .select({ fingerprint: controlPlaneCredentials.fingerprint })
      .from(controlPlaneCredentials)
      .where(
        and(
          eq(controlPlaneCredentials.workspaceId, workspaceId),
          eq(controlPlaneCredentials.status, "active"),
        ),
      ),
    dbConn
      .select({ resourceName: azureDiscoveredKeys.resourceName })
      .from(azureDiscoveredKeys)
      .where(
        and(
          eq(azureDiscoveredKeys.workspaceId, workspaceId),
          eq(azureDiscoveredKeys.resourceType, "keyVault"),
        ),
      )
      .limit(1),
    dbConn
      .select({
        title: findings.title,
        description: findings.description,
        endpoint: findings.endpoint,
        collectionId: findings.collectionId,
      })
      .from(findings)
      .innerJoin(collections, eq(findings.collectionId, collections.id))
      .where(and(eq(collections.workspaceId, workspaceId), eq(findings.severity, "Critical"))),
  ]);

  const managedFingerprints = new Set(credentials.map((item) => item.fingerprint));
  const tenant = `workspace:${workspaceId}`;
  const vault = getVault();

  let shadowCount = 0;
  let managedCount = 0;
  let analyzedCount = 0;

  for (const f of results) {
    const keyValue = extractKeyFromFinding(f);
    if (!keyValue) continue;
    analyzedCount += 1;

    const keyHash = sha256(keyValue);
    const keyPrefix = keyValue.substring(0, 8);
    const credentialFingerprint = vault.fingerprint(keyValue, tenant);
    const isManaged = managedFingerprints.has(credentialFingerprint);
    if (isManaged) {
      managedCount += 1;
    } else {
      const provider = detectProvider(keyValue);
      await dbConn
        .insert(shadowKeys)
        .values({
          workspaceId,
          keyHash,
          keyPrefix,
          provider,
          discoveredIn: f.endpoint ?? f.title,
          discoveredBy: "secret_scanner",
          riskLevel: "HIGH",
          isInVault: false,
          suggestedVault: vaults[0]?.resourceName,
          status: "open",
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shadowKeys.workspaceId, shadowKeys.keyHash],
          set: {
            keyPrefix,
            provider,
            discoveredIn: f.endpoint ?? f.title,
            riskLevel: "HIGH",
            suggestedVault: vaults[0]?.resourceName,
            lastSeenAt: new Date(),
            status: sql`CASE WHEN ${shadowKeys.status} = 'false_positive' THEN ${shadowKeys.status} ELSE 'open' END`,
            remediatedAt: sql`CASE WHEN ${shadowKeys.status} = 'false_positive' THEN ${shadowKeys.remediatedAt} ELSE NULL END`,
          },
        });
      shadowCount++;
    }
  }

  logger.info(
    { workspaceId, analyzedCount, shadowCount, managedCount },
    "[ShadowKeys] Detection complete",
  );
  return { analyzed: analyzedCount, shadow: shadowCount, managed: managedCount };
}

function extractKeyFromFinding(finding: {
  title: string;
  description: string | null;
}): string | null {
  // Common patterns in findings
  const patterns = [
    /sk-ant-[a-z0-9]{32,}/, // Anthropic
    /sk-[a-zA-Z0-9_-]{20,}/, // OpenAI
    /gh[psuro]_[A-Za-z0-9_]{36,}/, // GitHub PAT
    /AKIA[0-9A-Z]{16}/, // AWS access key
    /AIza[0-9A-Za-z_-]{35}/, // Google API key
    /xox[baprs]-[a-zA-Z0-9_-]{20,}/, // Slack
  ];

  const text = `${finding.title} ${finding.description ?? ""}`;
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[0];
  }
  return null;
}

function detectProvider(keyValue: string): string {
  if (keyValue.startsWith("sk-ant-")) return "anthropic";
  if (keyValue.startsWith("sk-")) return "openai";
  if (keyValue.startsWith("gh")) return "github";
  if (keyValue.startsWith("AKIA")) return "aws";
  if (keyValue.startsWith("AIza")) return "google";
  if (keyValue.startsWith("xox")) return "slack";
  return "unknown";
}

export const __test = { extractKeyFromFinding, detectProvider };
