/**
 * Shadow key detection engine.
 * Cross-references keys found in code (existing secret scanner) against keys in Azure Key Vault.
 * Keys in code that don't exist in any connected vault are "shadow keys."
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { azureDiscoveredKeys, shadowKeys } from "../../../drizzle/schema-enterprise";
import { findings } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sha256 } from "../../utils/crypto";

/**
 * Run shadow key analysis for a workspace.
 * Checks findings from existing secret scanner against discovered Key Vault keys.
 */
export async function detectShadowKeys(workspaceId: number): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) return;

  // Get all discovered keys (from vaults)
  const vaultKeys = await dbConn
    .select({ keyHash: azureDiscoveredKeys.keyHash })
    .from(azureDiscoveredKeys)
    .where(
      and(
        eq(azureDiscoveredKeys.workspaceId, workspaceId),
        eq(azureDiscoveredKeys.resourceType, "keyVault"),
      ),
    );

  const vaultKeyHashes = new Set(vaultKeys.map((k) => k.keyHash));

  // Get keys from existing secret scanner findings
  const results = await dbConn
    .select({
      title: findings.title,
      description: findings.description,
      severity: findings.severity,
      collectionId: findings.collectionId,
    })
    .from(findings)
    .where(and(eq(findings.userId, workspaceId), eq(findings.severity, "Critical")));

  let shadowCount = 0;

  for (const f of results) {
    // Extract potential key values from finding descriptions
    const keyValue = extractKeyFromFinding(f);
    if (!keyValue) continue;

    // Hash the key and check if it exists in any vault
    const keyHash = sha256(keyValue);
    if (!vaultKeyHashes.has(keyHash)) {
      const provider = detectProvider(keyValue);
      await dbConn
        .insert(shadowKeys)
        .values({
          workspaceId,
          keyHash,
          keyPrefix: keyValue.substring(0, 8),
          provider,
          discoveredIn: f.title,
          discoveredBy: "secret_scanner",
          riskLevel: "HIGH",
          isInVault: false,
          status: "open",
        })
        .onConflictDoNothing();
      shadowCount++;
    }
  }

  logger.info(
    { workspaceId, shadowCount, totalVaultKeys: vaultKeyHashes.size },
    "[ShadowKeys] Detection complete",
  );
}

function extractKeyFromFinding(finding: {
  title: string;
  description: string | null;
}): string | null {
  // Common patterns in findings
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/, // OpenAI
    /sk-ant-[a-z0-9]{32,}/, // Anthropic
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
  if (keyValue.startsWith("sk-")) return "openai";
  if (keyValue.startsWith("sk-ant-")) return "anthropic";
  if (keyValue.startsWith("gh")) return "github";
  if (keyValue.startsWith("AKIA")) return "aws";
  if (keyValue.startsWith("AIza")) return "google";
  if (keyValue.startsWith("xox")) return "slack";
  return "unknown";
}
