/**
 * Workspace-scoped API key lifecycle — create (show once), hash, scope,
 * expiry, last-used, IP restriction, repo restriction, rotation, revocation.
 */
import crypto from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { apiKeys } from "@rakshex/database";
import { hashApiKey, apiKeyPrefix as shortPrefix } from "../utils/crypto";
import { getDb } from "../db";

function secureId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

export type ApiKeyScope =
  | "scan:read"
  | "scan:write"
  | "collections:read"
  | "collections:write"
  | "projects:read"
  | "admin"
  | "*";

export interface CreateApiKeyInput {
  workspaceId: number;
  createdByUserId: number;
  name: string;
  environment?: "live" | "test";
  scopes?: string[];
  expiresAt?: Date | null;
  allowedIps?: string[];
  allowedRepositories?: string[];
  projectId?: string | null;
}

export interface ApiKeyPublic {
  id: string;
  workspaceId: number;
  name: string;
  keyPrefix: string;
  keySuffix: string | null;
  environment: string;
  scopes: string[];
  allowedIps: string[];
  allowedRepositories: string[];
  projectId: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

function toPublic(row: typeof apiKeys.$inferSelect): ApiKeyPublic {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    keySuffix: row.keySuffix ?? null,
    environment: row.environment,
    scopes: (row.scopes as string[]) ?? [],
    allowedIps: (row.allowedIps as string[]) ?? [],
    allowedRepositories: (row.allowedRepositories as string[]) ?? [],
    projectId: row.projectId ?? null,
    expiresAt: row.expiresAt ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    createdAt: row.createdAt,
  };
}

/** Generate raw key: rk_{env}_{32 bytes hex}. Shown once at creation. */
export function generateRawApiKey(env: "live" | "test" = "live"): string {
  return `rk_${env}_${crypto.randomBytes(24).toString("hex")}`;
}

export async function createWorkspaceApiKey(
  input: CreateApiKeyInput,
): Promise<{ rawKey: string; key: ApiKeyPublic }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const environment = input.environment ?? "live";
  const rawKey = generateRawApiKey(environment);
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = shortPrefix(rawKey);
  const keySuffix = rawKey.slice(-4);
  const id = secureId("ak");

  await db.insert(apiKeys).values({
    id,
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    keyPrefix,
    keyHash,
    keySuffix,
    environment,
    scopes: input.scopes ?? ["*"],
    allowedIps: input.allowedIps ?? [],
    allowedRepositories: input.allowedRepositories ?? [],
    projectId: input.projectId ?? null,
    expiresAt: input.expiresAt ?? null,
  });

  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return { rawKey, key: toPublic(rows[0]!) };
}

export async function listWorkspaceApiKeys(workspaceId: number): Promise<ApiKeyPublic[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspaceId));
  return rows.map(toPublic);
}

export async function getApiKeyById(id: string): Promise<ApiKeyPublic | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function revokeApiKey(id: string, workspaceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId), isNull(apiKeys.revokedAt)),
    );
  return true;
}

/**
 * Rotate: revoke old key, create new with same settings. Returns raw new key once.
 */
export async function rotateApiKey(
  id: string,
  workspaceId: number,
  userId: number,
): Promise<{ rawKey: string; key: ApiKeyPublic } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)))
    .limit(1);
  const existing = rows[0];
  if (!existing || existing.revokedAt) return null;

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKeys.id, id));

  return createWorkspaceApiKey({
    workspaceId,
    createdByUserId: userId,
    name: existing.name,
    environment: existing.environment as "live" | "test",
    scopes: (existing.scopes as string[]) ?? ["*"],
    expiresAt: existing.expiresAt,
    allowedIps: (existing.allowedIps as string[]) ?? [],
    allowedRepositories: (existing.allowedRepositories as string[]) ?? [],
    projectId: existing.projectId,
  }).then(async (created) => {
    await db
      .update(apiKeys)
      .set({ rotatedFromId: id, updatedAt: new Date() })
      .where(eq(apiKeys.id, created.key.id));
    return created;
  });
}

export interface ValidatedApiKey {
  keyId: string;
  workspaceId: number;
  userId: number;
  scopes: string[];
  projectId: string | null;
}

/**
 * Authenticate a raw API key. Enforces revoke, expiry, IP, and optional scope.
 * Updates lastUsedAt on success. Never returns the raw key.
 */
export async function validateWorkspaceApiKey(
  rawKey: string,
  opts?: { ip?: string | null; requiredScope?: string; repository?: string },
): Promise<ValidatedApiKey | null> {
  if (!rawKey || rawKey.length < 16) return null;
  const db = await getDb();
  if (!db) return null;

  const keyHash = hashApiKey(rawKey);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  const allowedIps = (row.allowedIps as string[]) ?? [];
  if (allowedIps.length > 0 && opts?.ip) {
    const ip = opts.ip.replace(/^::ffff:/, "");
    if (!allowedIps.includes(ip) && !allowedIps.includes(opts.ip)) {
      return null;
    }
  }

  const allowedRepos = (row.allowedRepositories as string[]) ?? [];
  if (allowedRepos.length > 0 && opts?.repository) {
    if (!allowedRepos.includes(opts.repository)) {
      return null;
    }
  }

  const scopes = (row.scopes as string[]) ?? [];
  if (opts?.requiredScope && !scopes.includes("*") && !scopes.includes(opts.requiredScope)) {
    return null;
  }

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));

  return {
    keyId: row.id,
    workspaceId: row.workspaceId,
    userId: row.createdByUserId,
    scopes,
    projectId: row.projectId ?? null,
  };
}

export function apiKeyHasScope(scopes: string[], required: string): boolean {
  return scopes.includes("*") || scopes.includes("admin") || scopes.includes(required);
}
