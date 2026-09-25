/**
 * Application vault singleton for encrypting enterprise credentials.
 * Uses AES-256-GCM via `encryptedVault` with RAKSHEX_VAULT_KEY.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
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

/* ─── Display masking ─────────────────────────────────────────────────── */

/**
 * Mask a secret for display: first 3 + last 2 chars (`sk-a…9f` style).
 * Short secrets (≤ 5 chars) are fully masked — showing first/last chars
 * of a 4-char secret would leak the whole thing.
 * The masked value is safe for logs, list APIs, and UI. Never log or
 * return the full secret outside a shown-once creation/rotation response.
 */
export function maskKey(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 5) return "•••••";
  return `${secret.slice(0, 3)}…${secret.slice(-2)}`;
}

/* ─── One-click rotation ──────────────────────────────────────────────── */

/** Grace window during which the previous secret stays valid after rotation. */
export const ROTATION_GRACE_MS = 15 * 60_000;

/** Minimal credential row shape the rotation logic needs (drizzle row compatible). */
export interface RotatableCredentialRow {
  id: number;
  workspaceId: number;
  name: string;
  encryptedValue: string;
  fingerprint: string;
  keyPrefix?: string | null;
  status: string;
  owner: string | null;
  previousEncryptedValue: string | null;
  previousFingerprint: string | null;
  graceExpiresAt: Date | null;
}

/** Narrow persistence seam — implemented by the tRPC router, faked in tests. */
export interface RotationStore {
  getCredential(id: number, workspaceId: number): Promise<RotatableCredentialRow | null>;
  updateCredential(
    id: number,
    workspaceId: number,
    patch: {
      encryptedValue: string;
      fingerprint: string;
      keyPrefix: string;
      owner?: string | null;
      previousEncryptedValue: string | null;
      previousFingerprint: string | null;
      graceExpiresAt: Date | null;
    },
  ): Promise<void>;
  audit(userId: number, action: string, details: Record<string, unknown>): Promise<void>;
}

/**
 * Generate a fresh credential secret server-side. Callers never supply
 * the new value — it is minted here and returned once for shown-once UX.
 */
export function generateCredentialSecret(): string {
  return `rk_${randomBytes(32).toString("base64url")}`;
}

/**
 * Check whether a presented secret value is currently valid for a credential
 * row: the current fingerprint, or the previous fingerprint inside its grace
 * window. Constant-time comparison; never throws on malformed input.
 */
export function credentialValueValid(
  row: Pick<RotatableCredentialRow, "fingerprint" | "previousFingerprint" | "graceExpiresAt">,
  candidateSecret: string,
  tenantId: string,
  vault: VaultHandle = getVault(),
  now: Date = new Date(),
): boolean {
  const candidateFp = vault.fingerprint(candidateSecret, tenantId);
  if (fingerprintsEqualSafe(candidateFp, row.fingerprint)) return true;
  if (
    row.previousFingerprint &&
    row.graceExpiresAt &&
    now.getTime() < row.graceExpiresAt.getTime() &&
    fingerprintsEqualSafe(candidateFp, row.previousFingerprint)
  ) {
    return true;
  }
  return false;
}

function fingerprintsEqualSafe(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export interface RotateCredentialInput {
  id: number;
  workspaceId: number;
  actorUserId: number;
  /** Human owner name/email to stamp on the credential. Defaults to existing. */
  owner?: string;
  /** Injectable for tests. Defaults to server-side generation + real vault. */
  generateSecret?: () => string;
  vault?: VaultHandle;
  now?: Date;
}

export interface RotateCredentialResult {
  id: number;
  /** Shown-once raw secret. Never persist or log this outside the response. */
  rawSecret: string;
  masked: string;
  graceExpiresAt: Date;
}

/**
 * One-click rotation: mint a new secret, re-encrypt, keep the old secret
 * valid for a 15-minute grace window, then it is rejected automatically
 * (time-based — no cron required). Audited to the audit log.
 *
 * Fail-closed: throws on missing credential, revoked status, or DB failure;
 * the old secret is untouched unless the update succeeds.
 */
export async function rotateCredential(
  store: RotationStore,
  input: RotateCredentialInput,
): Promise<RotateCredentialResult> {
  const now = input.now ?? new Date();
  const row = await store.getCredential(input.id, input.workspaceId);
  if (!row) throw new Error("Credential not found");
  if (row.status !== "active") throw new Error("Cannot rotate a non-active credential");

  const vault = input.vault ?? getVault();
  const tenantId = `workspace:${input.workspaceId}`;
  const newSecret = (input.generateSecret ?? generateCredentialSecret)();
  if (!newSecret || newSecret.length < 16) {
    throw new Error("Generated secret failed sanity check");
  }
  const encryptedValue = vault.encrypt(newSecret, tenantId).ciphertext;
  const fingerprint = vault.fingerprint(newSecret, tenantId);
  const graceExpiresAt = new Date(now.getTime() + ROTATION_GRACE_MS);

  await store.updateCredential(input.id, input.workspaceId, {
    encryptedValue,
    fingerprint,
    keyPrefix: maskKey(newSecret),
    owner: input.owner ?? row.owner,
    previousEncryptedValue: row.encryptedValue,
    previousFingerprint: row.fingerprint,
    graceExpiresAt,
  });

  await store.audit(input.actorUserId, "control_plane_credential_rotated", {
    workspaceId: input.workspaceId,
    credentialId: input.id,
    credentialName: row.name,
    owner: input.owner ?? row.owner,
    graceExpiresAt: graceExpiresAt.toISOString(),
  });

  return { id: input.id, rawSecret: newSecret, masked: maskKey(newSecret), graceExpiresAt };
}
