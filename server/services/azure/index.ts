/**
 * Azure SDK integration for Rakshex Enterprise.
 * Wraps @azure/identity and resource-specific SDKs behind a clean interface.
 */
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { logger } from "../../_core/logger";
import { ENV } from "../../_core/env";

export { AzureKeyVaultClient } from "./keyVaultClient";
export { AzureEntraClient } from "./entraClient";
export { AzureMonitorClient } from "./monitorClient";
export { AzureApiManagementClient } from "./apiManagementClient";

/**
 * Creates a DefaultAzureCredential for a given tenant.
 * Falls back to client secret credentials if env vars are set.
 */
export function getAzureCredential(tenantId?: string): DefaultAzureCredential {
  return new DefaultAzureCredential({
    tenantId: tenantId ?? (ENV.azureTenantId || undefined),
    ...(ENV.azureClientId && ENV.azureClientSecret
      ? { managedIdentityClientId: ENV.azureClientId }
      : {}),
  });
}

/**
 * Test connectivity to Azure with the current credential.
 */
export async function testAzureConnection(
  tenantId: string,
  subscriptionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const credential = getAzureCredential(tenantId);
    // Try to get a token for ARM — if this works, the credential is valid
    const token = await credential.getToken("https://management.azure.com/.default");
    if (!token) return { ok: false, error: "Failed to acquire token" };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, tenantId, subscriptionId }, "[Azure] Connection test failed");
    return { ok: false, error: msg };
  }
}
