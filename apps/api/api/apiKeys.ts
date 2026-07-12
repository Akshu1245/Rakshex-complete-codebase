/**
 * Workspace-scoped API key management (PROMPT 4).
 * Raw keys are returned only once at creation/rotation — never retrievable later.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { logger } from "../_core/logger";
import { requireWorkspacePermission } from "../services/authorization";
import {
  createWorkspaceApiKey,
  listWorkspaceApiKeys,
  revokeApiKey,
  rotateApiKey,
  validateWorkspaceApiKey,
  getApiKeyById,
} from "../services/workspaceApiKeys";

const scopeEnum = z.enum([
  "scan:read",
  "scan:write",
  "collections:read",
  "collections:write",
  "projects:read",
  "admin",
  "*",
]);

export const apiKeysRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        name: z.string().min(1).max(128),
        environment: z.enum(["live", "test"]).optional(),
        scopes: z.array(scopeEnum).min(1).optional(),
        expiresAt: z.string().datetime().optional(),
        allowedIps: z.array(z.string().max(45)).max(32).optional(),
        allowedRepositories: z.array(z.string().max(255)).max(64).optional(),
        projectId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "api_keys", "write");

      const { rawKey, key } = await createWorkspaceApiKey({
        workspaceId: input.workspaceId,
        createdByUserId: ctx.user.id,
        name: input.name,
        environment: input.environment,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        allowedIps: input.allowedIps,
        allowedRepositories: input.allowedRepositories,
        projectId: input.projectId,
      });

      await db.createAuditLogEntry(
        ctx.user.id,
        "api_key_created",
        { keyId: key.id, workspaceId: input.workspaceId, prefix: key.keyPrefix },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      logger.info(
        { userId: ctx.user.id, keyId: key.id, workspaceId: input.workspaceId },
        "[ApiKeys] Key created",
      );

      // rawKey shown once — never stored or returned again
      return {
        apiKey: rawKey,
        key: {
          id: key.id,
          name: key.name,
          keyPreview: `${key.keyPrefix}…${key.keySuffix ?? "****"}`,
          environment: key.environment,
          scopes: key.scopes,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          allowedIps: key.allowedIps,
          allowedRepositories: key.allowedRepositories,
          createdAt: key.createdAt.toISOString(),
        },
      };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "api_keys", "read");
      const keys = await listWorkspaceApiKeys(input.workspaceId);
      return {
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPreview: `${k.keyPrefix}…${k.keySuffix ?? "****"}`,
          environment: k.environment,
          scopes: k.scopes,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          allowedIps: k.allowedIps,
          allowedRepositories: k.allowedRepositories,
          projectId: k.projectId,
          createdAt: k.createdAt.toISOString(),
        })),
      };
    }),

  revoke: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        keyId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "api_keys", "delete");
      const existing = await getApiKeyById(input.keyId);
      if (!existing || existing.workspaceId !== input.workspaceId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }
      await revokeApiKey(input.keyId, input.workspaceId);
      await db.createAuditLogEntry(
        ctx.user.id,
        "api_key_revoked",
        { keyId: input.keyId, workspaceId: input.workspaceId },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );
      logger.info({ keyId: input.keyId }, "[ApiKeys] Key revoked");
      return { success: true };
    }),

  rotate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        keyId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "api_keys", "write");
      const rotated = await rotateApiKey(input.keyId, input.workspaceId, ctx.user.id);
      if (!rotated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found or already revoked" });
      }
      await db.createAuditLogEntry(
        ctx.user.id,
        "api_key_rotated",
        {
          oldKeyId: input.keyId,
          newKeyId: rotated.key.id,
          workspaceId: input.workspaceId,
        },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );
      return {
        apiKey: rotated.rawKey,
        key: {
          id: rotated.key.id,
          name: rotated.key.name,
          keyPreview: `${rotated.key.keyPrefix}…${rotated.key.keySuffix ?? "****"}`,
          createdAt: rotated.key.createdAt.toISOString(),
        },
      };
    }),

  /**
   * Validate a key (for CLI / extension). Does not return the key material.
   */
  validate: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().min(8),
        requiredScope: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await validateWorkspaceApiKey(input.apiKey, {
        ip: ctx.req.ip,
        requiredScope: input.requiredScope,
      });
      if (!result) {
        return { valid: false as const, reason: "invalid_or_restricted" };
      }
      return {
        valid: true as const,
        workspaceId: result.workspaceId,
        keyId: result.keyId,
        scopes: result.scopes,
      };
    }),
});
