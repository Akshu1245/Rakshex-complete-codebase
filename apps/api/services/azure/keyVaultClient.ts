/**
 * Azure Key Vault client.
 * Discovers secrets, keys, and certificates across vaults.
 */
import { SecretClient, type SecretProperties } from "@azure/keyvault-secrets";
import { getAzureCredential } from "./index";
import { logger } from "../../_core/logger";

export interface KeyVaultSecret {
  name: string;
  id: string;
  contentType?: string;
  createdOn?: Date;
  expiresOn?: Date;
  lastRotatedOn?: Date;
  enabled: boolean;
  tags?: Record<string, string>;
}

export interface KeyVaultDiscoveryResult {
  vaultUrl: string;
  secrets: KeyVaultSecret[];
  error?: string;
}

export class AzureKeyVaultClient {
  /**
   * Discover all secrets in a Key Vault.
   * Uses the SecretClient SDK and returns metadata (never secret values).
   */
  static async discoverSecrets(
    vaultUrl: string,
    tenantId?: string,
  ): Promise<KeyVaultDiscoveryResult> {
    try {
      const credential = getAzureCredential(tenantId);
      const client = new SecretClient(vaultUrl, credential);
      const secrets: KeyVaultSecret[] = [];

      for await (const secret of client.listPropertiesOfSecrets()) {
        if (secret.name.startsWith("---")) continue; // skip synthetic entries
        secrets.push({
          name: secret.name,
          id: secret.id ?? "",
          contentType: secret.contentType,
          createdOn: secret.createdOn,
          expiresOn: secret.expiresOn,
          enabled: secret.enabled,
          tags: secret.tags,
        });
      }

      logger.info({ vaultUrl, count: secrets.length }, "[AzureKV] Discovery complete");
      return { vaultUrl, secrets };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, vaultUrl }, "[AzureKV] Discovery failed");
      return { vaultUrl, secrets: [], error: msg };
    }
  }

  /**
   * Get the current value of a secret (used for rotation verification).
   */
  static async getSecretValue(
    vaultUrl: string,
    secretName: string,
    tenantId?: string,
  ): Promise<string | null> {
    try {
      const credential = getAzureCredential(tenantId);
      const client = new SecretClient(vaultUrl, credential);
      const secret = await client.getSecret(secretName);
      return secret.value ?? null;
    } catch (err: unknown) {
      logger.error({ err, vaultUrl, secretName }, "[AzureKV] Get secret failed");
      return null;
    }
  }

  /**
   * Rotate a secret in Key Vault by creating a new version.
   */
  static async rotateSecret(
    vaultUrl: string,
    secretName: string,
    newValue: string,
    tenantId?: string,
  ): Promise<boolean> {
    try {
      const credential = getAzureCredential(tenantId);
      const client = new SecretClient(vaultUrl, credential);
      await client.setSecret(secretName, newValue);
      logger.info({ vaultUrl, secretName }, "[AzureKV] Secret rotated");
      return true;
    } catch (err: unknown) {
      logger.error({ err, vaultUrl, secretName }, "[AzureKV] Rotation failed");
      return false;
    }
  }
}
