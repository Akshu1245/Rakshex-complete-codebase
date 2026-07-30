/**
 * Encryption vault for sensitive credentials at rest.
 * Requires RAKSHEX_VAULT_KEY (32+ chars). Legacy DEVPULSE_VAULT_KEY is accepted
 * only as a temporary migration fallback and should be removed after rotate.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function getVaultKeyMaterial(): Buffer {
  const key =
    process.env.RAKSHEX_VAULT_KEY?.trim() || process.env.DEVPULSE_VAULT_KEY?.trim();
  if (!key || key.length < 32) {
    throw new Error(
      "Vault key not configured: set RAKSHEX_VAULT_KEY (32+ chars). " +
        "In development, generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  // Derive a 32-byte key from the secret material
  return scryptSync(key, "rakshex-vault-v1", 32);
}

export function encryptVault(plaintext: string): string {
  const key = getVaultKeyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptVault(payload: string): string {
  const key = getVaultKeyMaterial();
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid vault payload format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isVaultConfigured(): boolean {
  try {
    getVaultKeyMaterial();
    return true;
  } catch {
    return false;
  }
}
