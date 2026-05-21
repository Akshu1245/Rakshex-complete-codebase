/**
 * API Keys Router — Workspace-scoped API key management.
 *
 * Each key belongs to a workspace and has a role that determines
 * what the key can do when used for authentication. Keys are used
 * by the Rakshex SDK, VS Code extension, CLI, and CI pipelines.
 */
import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import crypto from "crypto";
import { logger } from "../_core/logger";

function generateApiKey(): string {
  return `dp_${crypto.randomBytes(24).toString("hex")}`;
}

export const apiKeysRouter = router({
  /**
   * Create a new API key for the calling user's account.
   * Only works for single-tenant mode; workspace-scoped keys
   * are managed via the workspace settings page.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const apiKey = generateApiKey();

      await db.updateUserApiKey(ctx.user.id, apiKey);

      logger.info({ userId: ctx.user.id, keyPrefix: apiKey.slice(0, 8) }, "[ApiKeys] Key created");

      return {
        apiKey,
        name: input.name ?? "Default",
        expiresAt: input.expiresAt ?? null,
      };
    }),

  /**
   * List existing API keys for the user. Returns masked keys
   * (only first 8 and last 4 characters visible).
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    const key = user?.apiKey;

    if (!key) return { keys: [] };

    return {
      keys: [
        {
          id: "default",
          name: "Default",
          keyPreview: `${key.slice(0, 8)}...${key.slice(-4)}`,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }),

  /**
   * Revoke (regenerate) the user's API key. The old key stops working
   * immediately; the new key is returned in cleartext.
   */
  revoke: adminProcedure.mutation(async ({ ctx }) => {
    const apiKey = generateApiKey();
    await db.updateUserApiKey(ctx.user.id, apiKey);
    await db.createAuditLogEntry(ctx.user.id, "api_key_revoked", {});

    logger.info({ userId: ctx.user.id }, "[ApiKeys] Key rotated");

    return { apiKey };
  }),

  /**
   * Validate an API key. Returns the associated user and workspace.
   * Used by the VS Code extension's authenticate flow.
   */
  validate: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await db.getUserByApiKey(input.apiKey);
      if (!user) {
        return { valid: false, user: null };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
      };
    }),
});
