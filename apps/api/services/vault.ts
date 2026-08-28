/**
 * Application vault singleton for encrypting enterprise credentials.
 * Uses AES-256-GCM via `encryptedVault` with RAKSHEX_VAULT_KEY.
 */
import { createVault, type VaultHandle } from "./encryptedVault";

let _vault: VaultHandle | null = null;

function resolveVaultKeyMaterial(): string {
  const key = process.env.RAKSHEX_VAULT_KEY?.trim();
  if (!key || key.length < 32) {
    throw new Error(
      "Vault key not configured: set RAKSHEX_VAULT_KEY (32+ chars). " +
        "In development, generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return key;
}

/** Return the process-wide vault handle (lazy). */
export function getVault(): VaultHandle {
  if (!_vault) {
    _vault = createVault({ key: resolveVaultKeyMaterial() });
  }
  return _vault;
}

export function isVaultConfigured(): boolean {
  try {
    resolveVaultKeyMaterial();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a secret for a tenant (workspace or user id as string). */
export function encryptSecret(plaintext: string, tenantId: string): string {
  return getVault().encrypt(plaintext, tenantId).ciphertext;
}

/** Decrypt a secret previously produced by encryptSecret. */
export function decryptSecret(ciphertext: string, tenantId: string): string {
  return getVault().decrypt({ ciphertext }, tenantId);
}
