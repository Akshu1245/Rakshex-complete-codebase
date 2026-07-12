/**
 * Key rotation engine.
 * Handles the full rotation workflow: generate new key → deploy → verify → retire old.
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { keyRotationRequests, azureDiscoveredKeys } from "@rakshex/database/schema-enterprise";
import { eq } from "drizzle-orm";
import { AzureKeyVaultClient } from "../azure/keyVaultClient";
import { sha256, randomUUID } from "../../utils/crypto";

/**
 * Execute a key rotation.
 * 1. Generate new value
 * 2. Update in Key Vault
 * 3. Mark old key as rotated
 * 4. Create new discovered key entry
 * 5. Log completion
 */
export async function executeRotation(
  rotationId: string,
): Promise<{ success: boolean; error?: string }> {
  const dbConn = await db.getDb();
  if (!dbConn) return { success: false, error: "No database connection" };

  const request = (
    await dbConn
      .select()
      .from(keyRotationRequests)
      .where(eq(keyRotationRequests.id, rotationId))
      .limit(1)
  )[0];
  if (!request) return { success: false, error: "Rotation request not found" };

  try {
    // Update status
    await dbConn
      .update(keyRotationRequests)
      .set({ status: "in_progress", rotationStartedAt: new Date() })
      .where(eq(keyRotationRequests.id, rotationId));

    // Get the key details
    const key = (
      await dbConn
        .select()
        .from(azureDiscoveredKeys)
        .where(eq(azureDiscoveredKeys.id, request.discoveredKeyId))
        .limit(1)
    )[0];
    if (!key) throw new Error(`Discovered key ${request.discoveredKeyId} not found`);

    // Generate new value
    const newValue = randomUUID() + randomUUID();

    // Rotate in Azure Key Vault if applicable
    if (key.resourceType === "keyVault" && key.resourceName) {
      const ok = await AzureKeyVaultClient.rotateSecret(key.resourceName, key.keyName, newValue);
      if (!ok) throw new Error(`Failed to rotate secret in ${key.resourceName}`);
    }

    // Mark old key as rotated
    await dbConn
      .update(azureDiscoveredKeys)
      .set({ status: "rotated", lastRotatedAt: new Date() })
      .where(eq(azureDiscoveredKeys.id, request.discoveredKeyId));

    // Create new discovered key entry for the rotated version
    const newKeyHash = sha256(newValue);
    await dbConn.insert(azureDiscoveredKeys).values({
      workspaceId: request.workspaceId,
      resourceType: key.resourceType,
      resourceName: key.resourceName,
      resourceId: key.resourceId,
      keyName: key.keyName,
      keyType: key.keyType,
      keyHash: newKeyHash,
      scopes: key.scopes ?? [],
      isExpired: false,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      status: "active",
    });

    // Mark rotation as complete
    await dbConn
      .update(keyRotationRequests)
      .set({ status: "completed", rotationCompletedAt: new Date() })
      .where(eq(keyRotationRequests.id, rotationId));

    logger.info(
      { rotationId, keyName: key.keyName },
      "[Rotation] Key rotation completed successfully",
    );
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await dbConn
      .update(keyRotationRequests)
      .set({ status: "failed", errorMessage: msg, rotationCompletedAt: new Date() })
      .where(eq(keyRotationRequests.id, rotationId));
    logger.error({ err, rotationId }, "[Rotation] Key rotation failed");
    return { success: false, error: msg };
  }
}
