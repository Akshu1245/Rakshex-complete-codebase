/**
 * Global discovery orchestrator.
 * Fans out discovery jobs across all connected Azure subscriptions and GitHub orgs.
 */
import { AzureKeyVaultClient } from "../azure/keyVaultClient";
import { AzureEntraClient } from "../azure/entraClient";
import { AzureApiManagementClient } from "../azure/apiManagementClient";
import { getAzureCredential } from "../azure";
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { discoveryRuns, azureDiscoveredKeys } from "../../../drizzle/schema-enterprise";
import { sha256 } from "../../utils/crypto";
import { sql } from "drizzle-orm";

export interface DiscoveryConfig {
  workspaceId: number;
  connectionId: number;
  tenantId: string;
  subscriptionId: string;
}

/**
 * Run full discovery for a workspace's Azure connection.
 */
export async function runAzureDiscovery(config: DiscoveryConfig): Promise<void> {
  const runId = `disc_${Date.now()}_${config.workspaceId}`;
  logger.info({ ...config, runId }, "[Discovery] Starting Azure discovery");

  const dbConn = await db.getDb();
  if (!dbConn) {
    logger.error({ runId }, "[Discovery] No database connection");
    return;
  }

  await dbConn.insert(discoveryRuns).values({
    id: runId,
    workspaceId: config.workspaceId,
    connectionId: config.connectionId,
    status: "running",
  });

  let totalKeys = 0;

  try {
    // 1. Discover Key Vaults
    const vaults = await discoverKeyVaults(config.subscriptionId, config.tenantId);
    for (const vaultUrl of vaults) {
      const result = await AzureKeyVaultClient.discoverSecrets(vaultUrl, config.tenantId);
      for (const secret of result.secrets) {
        const keyHash = sha256(`${vaultUrl}/${secret.name}`);
        await dbConn
          .insert(azureDiscoveredKeys)
          .values({
            workspaceId: config.workspaceId,
            connectionId: config.connectionId,
            resourceType: "keyVault",
            resourceName: vaultUrl,
            resourceId: vaultUrl,
            keyName: secret.name,
            keyType: "secret",
            keyHash,
            scopes: [],
            isExpired: secret.expiresOn ? secret.expiresOn < new Date() : false,
            expiresAt: secret.expiresOn,
            status: secret.enabled ? "active" : "expired",
            discoveryRunId: runId,
          })
          .onConflictDoNothing();
        totalKeys++;
      }
    }

    // 2. Discover Service Principals
    const spResult = await AzureEntraClient.discoverServicePrincipals(config.tenantId);
    for (const sp of spResult.principals) {
      for (const cred of sp.passwordCredentials) {
        const keyHash = sha256(`${sp.id}/${cred.id}`);
        await dbConn
          .insert(azureDiscoveredKeys)
          .values({
            workspaceId: config.workspaceId,
            connectionId: config.connectionId,
            resourceType: "servicePrincipal",
            resourceName: sp.displayName,
            resourceId: sp.id,
            keyName: cred.displayName ?? `cred_${cred.id}`,
            keyType: "password",
            keyHash,
            scopes: sp.roles,
            isExpired: cred.endDate ? new Date(cred.endDate) < new Date() : false,
            expiresAt: cred.endDate ? new Date(cred.endDate) : undefined,
            assignedTo: sp.displayName,
            status: sp.enabled ? "active" : "expired",
            discoveryRunId: runId,
            metadata: { appId: sp.appId, credentialId: cred.id },
          })
          .onConflictDoNothing();
        totalKeys++;
      }
    }

    // 3. Discover API Management subscriptions
    const apimServices = await AzureApiManagementClient.listServices(
      config.subscriptionId,
      config.tenantId,
    );
    for (const apim of apimServices) {
      const result = await AzureApiManagementClient.discover(
        config.subscriptionId,
        apim.resourceGroup,
        apim.name,
        config.tenantId,
      );
      for (const sub of result.subscriptions) {
        const keyHash = sha256(`apim/${apim.name}/${sub.id}`);
        await dbConn
          .insert(azureDiscoveredKeys)
          .values({
            workspaceId: config.workspaceId,
            connectionId: config.connectionId,
            resourceType: "apiManagement",
            resourceName: apim.name,
            resourceId: `/subscriptions/${config.subscriptionId}/resourceGroups/${apim.resourceGroup}/providers/Microsoft.ApiManagement/service/${apim.name}/subscriptions/${sub.id}`,
            keyName: sub.name,
            keyType: "subscription_key",
            keyHash,
            scopes: [sub.scope],
            isExpired: sub.state !== "active",
            expiresAt: sub.expirationDate ? new Date(sub.expirationDate) : undefined,
            assignedTo: sub.userId,
            status: sub.state,
            discoveryRunId: runId,
          })
          .onConflictDoNothing();
        totalKeys++;
      }
    }

    // Mark run as completed
    await dbConn
      .update(discoveryRuns)
      .set({ status: "completed", completedAt: new Date(), keysFound: totalKeys })
      .where(sql`id = ${runId}`);
    logger.info({ runId, totalKeys }, "[Discovery] Azure discovery completed");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, runId }, "[Discovery] Azure discovery failed");
    await dbConn
      .update(discoveryRuns)
      .set({ status: "failed", completedAt: new Date(), errorMessage: msg })
      .where(sql`id = ${runId}`);
  }
}

/**
 * Discover Key Vault URLs in a subscription.
 * Uses Azure Resource Graph if available, otherwise checks common patterns.
 */
async function discoverKeyVaults(subscriptionId: string, tenantId?: string): Promise<string[]> {
  try {
    const credential = getAzureCredential(tenantId);
    const token = await credential.getToken("https://management.azure.com/.default");
    if (!token) return [];

    const headers = { Authorization: `Bearer ${token.token}` };
    const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.KeyVault/vaults?api-version=2022-07-01`;
    const response = await fetch(url, { headers });
    if (!response.ok) return [];

    const data = (await response.json()) as {
      value: Array<{ name: string; properties?: { vaultUri?: string } }>;
    };
    return data.value.map((v) => v.properties?.vaultUri ?? `https://${v.name}.vault.azure.net`);
  } catch (err) {
    logger.error({ err }, "[Discovery] Failed to discover Key Vaults");
    return [];
  }
}
