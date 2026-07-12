/**
 * Settings Router
 * Handles user account settings: profile, security, notifications, account deletion
 */
import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./utils/password";
import { logger } from "./_core/logger";
import { COOKIE_NAME } from "@rakshex/shared-types/const";
import { getSessionCookieOptions } from "./_core/cookies";

// ============================================================================
// TOTP HELPERS (RFC 6238)
// ============================================================================

const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1; // allow ±1 step (30s drift tolerance)

/**
 * Generate a base32-encoded random secret for TOTP.
 */
function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Build an otpauth:// URI for authenticator apps.
 */
function buildOtpauthUri(secret: string, email: string): string {
  const issuer = encodeURIComponent("Rakshex");
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

/**
 * Verify a TOTP code against the given secret.
 * Uses a ±1 step window for clock drift tolerance.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const step = Math.floor(now / TOTP_STEP_SECONDS);

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const counter = step + offset;
    const expected = generateTotp(key, counter);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

function generateTotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

/**
 * Base32 encode (RFC 4648, no padding).
 */
function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Base32 decode.
 */
export function base32Decode(str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const lookup = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) lookup.set(alphabet[i], i);

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const ch of str.toUpperCase()) {
    const val = lookup.get(ch);
    if (val === undefined) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Pending 2FA secrets are now persisted in the DB (pendingTotpSecret + pendingTotpExpiresAt columns)
// This survives server restarts and works in multi-instance deployments.

// ============================================================================
// SETTINGS ROUTER
// ============================================================================

export const settingsRouter = router({
  // ==========================================================================
  // PROFILE TAB
  // ==========================================================================

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const user = await db.getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email().max(320).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const updates: { name?: string; email?: string } = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.email !== undefined) updates.email = input.email;

      await db.updateUserProfile(ctx.user.id, updates);

      // Log the action
      await db.createAuditLogEntry(
        ctx.user.id,
        "profile_updated",
        { updates: Object.keys(updates) },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      return { success: true };
    }),

  // ==========================================================================
  // SECURITY TAB
  // ==========================================================================

  getSessions: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const sessions = await db.getUserSessions(ctx.user.id);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        // Current session detection could be enhanced with session token comparison
      })),
    };
  }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      // Ownership check: verify the session belongs to the current user
      const sessions = await db.getUserSessions(ctx.user.id);
      const owned = sessions.find((s) => s.id === input.sessionId);
      if (!owned) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      await db.revokeUserSession(input.sessionId);

      await db.createAuditLogEntry(
        ctx.user.id,
        "session_revoked",
        { sessionId: input.sessionId },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      return { success: true };
    }),

  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    await db.revokeAllUserSessions(ctx.user.id);

    await db.createAuditLogEntry(
      ctx.user.id,
      "all_sessions_revoked",
      {},
      ctx.req.ip,
      ctx.req.headers["user-agent"] as string,
    );

    return { success: true };
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      // Get user with password
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account was created via SSO and has no password set.",
        });
      }

      if (!verifyPassword(input.currentPassword, user.passwordHash)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }

      // Hash and update new password (PBKDF2-SHA512 via ./utils/password)
      const hashedNewPassword = hashPassword(input.newPassword);
      await db.updateUserPassword(ctx.user.id, hashedNewPassword);

      // Log the action
      await db.createAuditLogEntry(
        ctx.user.id,
        "password_changed",
        {},
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      // Revoke all other sessions for security
      await db.revokeAllUserSessions(ctx.user.id);

      return { success: true };
    }),

  // ==========================================================================
  // NOTIFICATIONS TAB
  // ==========================================================================

  getEmailPreferences: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const prefs = await db.getOrCreateEmailPreferences(ctx.user.id);
    return {
      scanComplete: prefs.scanComplete,
      budgetAlerts: prefs.budgetAlerts,
      weeklyDigest: prefs.weeklyDigest,
      teamActivity: prefs.teamActivity,
      promotionalEmails: prefs.promotionalEmails,
    };
  }),

  updateEmailPreferences: protectedProcedure
    .input(
      z.object({
        scanComplete: z.boolean().optional(),
        budgetAlerts: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
        teamActivity: z.boolean().optional(),
        promotionalEmails: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      await db.updateEmailPreferences(ctx.user.id, input);

      await db.createAuditLogEntry(
        ctx.user.id,
        "email_preferences_updated",
        { changed: Object.keys(input) },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      return { success: true };
    }),

  // ==========================================================================
  // TWO-FACTOR AUTHENTICATION
  // ==========================================================================

  /**
   * Step 1: Start 2FA setup — generates a TOTP secret and returns an
   * otpauth:// URI (for QR code rendering) and the raw secret.
   * The secret is held in memory until enable2FA is called or it expires.
   */
  setup2FA: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    }

    const user = await db.getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpauthUri(secret, user.email);

    // Store the pending secret in DB (valid for 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.updatePendingTotpSecret(ctx.user.id, secret, expiresAt);

    logger.info(`[2FA] Setup initiated for user ${ctx.user.id}`);

    return {
      secret,
      otpauthUri,
    };
  }),

  /**
   * Step 2: Verify the TOTP code and actually enable 2FA.
   * If the code matches the pending secret, we persist it on the user record.
   */
  enable2FA: protectedProcedure
    .input(
      z.object({
        code: z
          .string()
          .length(6)
          .regex(/^\d{6}$/),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const pending = await db.getPendingTotpSecret(ctx.user.id);
      if (
        !pending ||
        !pending.pendingTotpSecret ||
        !pending.pendingTotpExpiresAt ||
        new Date(pending.pendingTotpExpiresAt) < new Date()
      ) {
        // Clear expired pending secret
        if (pending?.pendingTotpSecret) {
          await db.updatePendingTotpSecret(ctx.user.id, null, null);
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA setup session expired. Please start setup again.",
        });
      }

      if (!verifyTotpCode(pending.pendingTotpSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code. Please try again.",
        });
      }

      // Persist the TOTP secret on the user record
      await db.updateUserTotpSecret(ctx.user.id, pending.pendingTotpSecret);
      // Clear the pending secret
      await db.updatePendingTotpSecret(ctx.user.id, null, null);

      await db.createAuditLogEntry(
        ctx.user.id,
        "2fa_enabled",
        {},
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      logger.info(`[2FA] Enabled for user ${ctx.user.id}`);

      return { success: true };
    }),

  /**
   * Disable 2FA — requires the user's current password for confirmation.
   */
  disable2FA: protectedProcedure
    .input(
      z.object({
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Verify password
      if (!user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect password",
        });
      }

      await db.updateUserTotpSecret(ctx.user.id, null);

      await db.createAuditLogEntry(
        ctx.user.id,
        "2fa_disabled",
        {},
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      logger.info(`[2FA] Disabled for user ${ctx.user.id}`);

      return { success: true };
    }),

  /**
   * Get 2FA status for the current user.
   */
  get2FAStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    }

    const user = await db.getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      enabled: Boolean((user as any).totpSecret),
    };
  }),

  // ==========================================================================
  // DANGER ZONE - ACCOUNT DELETION
  // ==========================================================================

  getAuditLog: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const logs = await db.getAuditLogForUser(ctx.user.id, input.limit);
      return {
        logs: logs.map((l) => ({
          id: l.id,
          action: l.action,
          details: l.details,
          ipAddress: l.ipAddress,
          createdAt: l.createdAt,
        })),
      };
    }),

  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE MY ACCOUNT"),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      // Create final audit log before deletion
      await db.createAuditLogEntry(
        ctx.user.id,
        "account_deletion_requested",
        { reason: input.reason || "No reason provided" },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      // Delete everything
      const result = await db.deleteUserAccount(ctx.user.id);

      // Clear the session cookie so the deleted user cannot make further requests
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return result;
    }),
});

export type SettingsRouter = typeof settingsRouter;
