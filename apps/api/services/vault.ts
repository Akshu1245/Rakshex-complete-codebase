/**
 * Application vault singleton for encrypting enterprise credentials.
 */
import { ENV } from "../_core/env";
import { createVault, type VaultHandle } from "./encryptedVault";

let _vault: VaultHandle | null = null;

function getVaultKey(): string {
  const key = process.env.RAKSHEX_VAULT_KEY?.trim() || process.env.DEVPULSE_VAULT_KEY?.trim();
  if (!key || key.length < 32) {
    throw new Error(
      "Vault key not configured: set RAKSHEX_VAULT_KEY or DEVPULSE_VAULT_KEY (32+ chars). " +
        "In development, generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return key;
}

export function getVault(): VaultHandle {
  if (!_vault) {
    _vault = createVault({ key: getVaultKey() });
  }
  return _vault;
}

export function encryptSecret(plaintext: string, tenantId: string): string {
  return getVault().encrypt(plaintext, tenantId).ciphertext;
}

export function decryptSecret(ciphertext: string, tenantId: string): string {
  return getVault().decrypt({ ciphertext }, tenantId);
}
