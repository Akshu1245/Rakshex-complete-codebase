import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, setCsrfCookie } from "./_core/trpc";
import * as db from "./db";
import { sendPasswordResetEmail } from "./email";
import { settingsRouter, verifyTotpCode } from "./settingsRouter";
import { hashPassword, verifyPassword } from "./utils/password";
import { users } from "../drizzle/schema";
import { sql } from "drizzle-orm";

// Import individual routers
import { collectionsRouter } from "./api/collections";
import { scanningRouter } from "./api/scanning";
import { shadowAPIRouter } from "./api/shadowAPI";
import { tokenAnalyticsRouter } from "./api/tokenAnalytics";
import { killSwitchRouter } from "./api/killSwitch";
import { complianceRouter } from "./api/compliance";
import { teamRouter } from "./api/team";
import { onboardingRouter } from "./api/onboarding";
import { dashboardRouter } from "./api/dashboard";
import { adminRouter } from "./api/admin";
import { paymentsRouter } from "./api/payments";
import { webhooksRouter } from "./api/webhooks";

import { vscodeExtensionRouter } from "./api/vscodeExtension";
import { mcpGovernanceRouter } from "./api/mcpGovernance";
import { runtimeGovernanceRouter } from "./api/runtimeGovernance";
import { riskScoreRouter } from "./api/riskScore";
import { shadowAiDetectionRouter } from "./api/shadowAiDetection";
import { socTwoRouter } from "./api/socTwo";
import { policiesRouter } from "./api/policies";
import { alertsRouter } from "./api/alerts";
import { dataExportRouter } from "./api/dataExport";
import { apiDocsRouter, setAppRouterForDocs } from "./api/apiDocs";
import { ssoRouter } from "./api/sso";
import { workspacesRouter } from "./api/workspaces";
import { researchRouter } from "./api/research";
import { telemetryRouter } from "./api/telemetry";
import { ensurePersonalWorkspace } from "./services/workspaceContext";
import { logger } from "./_core/logger";

// ============================================================================
// MAIN ROUTER - merges all individual routers
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    /**
     * Sign out of every active session for the calling user. Used by the
     * "I see suspicious activity, log me out everywhere" flow on the
     * settings page and as the default revoke step after a successful
     * password reset. We also clear the local cookie so the user has to
     * re-authenticate on this device.
     */
    logoutAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
      await db.revokeAllUserSessions(ctx.user.id);
      await db.createAuditLogEntry(
        ctx.user.id,
        "logout_all_sessions",
        {},
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    /**
     * List the active sessions for the calling user — feeds the
     * "Your devices" panel so users can spot a session they don't
     * recognize and revoke it.
     */
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await db.getUserSessions(ctx.user.id);
      return sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));
    }),
    /**
     * Revoke a specific session by id (the row id, not the cookie).
     */
    revokeSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const session = await db.getUserSessions(ctx.user.id);
        const owned = session.find(s => s.id === input.sessionId);
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
          ctx.req.headers["user-agent"] as string
        );
        return { success: true };
      }),
    signup: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(8).max(128),
          name: z.string().min(1).max(120),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const existing = await db.getUserByEmail(normalizedEmail);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }

        const passwordHash = hashPassword(input.password);
        const created = await db.createLocalUser({
          email: normalizedEmail,
          name: input.name.trim(),
          passwordHash,
        });

        // First user on a fresh deployment is auto-promoted to admin.
        // This lets a self-hosted operator create their owner account by
        // just signing up normally instead of running a CLI.
        try {
          const driver = await db.getDb();
          if (driver) {
            const rows = await driver
              .select({ n: sql<number>`count(*)` })
              .from(users);
            const total = Number(rows[0]?.n ?? 0);
            if (total === 1) {
              await db.updateUser(created.id, {
                role: "admin",
                plan: "enterprise",
              });
            }
          }
        } catch (err) {
          logger.warn({ err: err }, "[signup] first-user promotion skipped");
        }

        // Auto-create the user's personal workspace + owner membership.
        // Idempotent — never fails signup if it can't be created.
        try {
          await ensurePersonalWorkspace(created.id, input.name.trim());
        } catch (err) {
          logger.warn(
            { err: err, userId: created.id },
            "[signup] personal workspace creation skipped"
          );
        }

        const sessionToken = await sdk.createSessionToken(created.openId, {
          name: input.name.trim(),
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Set CSRF token cookie so the client can send it on subsequent mutations
        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          created.id,
          "signup_email",
          { email: normalizedEmail },
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string
        );

        return {
          success: true,
          userId: created.id,
        };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const user = await db.getUserByEmail(normalizedEmail);

        // Always throw the same error on unknown email / wrong password to
        // avoid leaking which accounts exist. Legitimate server errors
        // still surface as INTERNAL_SERVER_ERROR.
        const invalidCredentials = new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });

        if (!user || !user.passwordHash) {
          throw invalidCredentials;
        }

        if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Account temporarily locked. Try again in a few minutes.",
          });
        }

        const ok = verifyPassword(input.password, user.passwordHash);
        if (!ok) {
          const { attempts, lockedUntil } =
            await db.incrementFailedLoginAttempts(user.id);
          await db.createAuditLogEntry(
            user.id,
            "login_failed",
            { email: normalizedEmail, attempts, lockedUntil },
            ctx.req.ip,
            ctx.req.headers["user-agent"] as string
          );
          throw invalidCredentials;
        }

        await db.resetFailedLoginAttempts(user.id);

        // Check if user has 2FA enabled — if so, require TOTP verification
        // before creating a session.
        const userWithTotp = await db.getUserById(user.id);
        if (userWithTotp && (userWithTotp as any).totpSecret) {
          return { success: false, requires2FA: true, userId: user.id };
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Set CSRF token cookie so the client can send it on subsequent mutations
        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          user.id,
          "login_email",
          { email: normalizedEmail },
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string
        );

        return { success: true, userId: user.id };
      }),
    /**
     * Verify 2FA code during login. Called after the login mutation
     * returns { requires2FA: true, userId }.
     */
    verify2FALogin: publicProcedure
      .input(z.object({ userId: z.string().length(1).max(100), code: z.string().length(6).regex(/^\d{6}$/) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(Number(input.userId));
        if (!user || !(user as any).totpSecret) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "2FA not required for this account" });
        }

        if (!verifyTotpCode((user as any).totpSecret, input.code)) {
          await db.createAuditLogEntry(
            user.id,
            "login_2fa_failed",
            {},
            ctx.req.ip,
            ctx.req.headers["user-agent"] as string
          );
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid 2FA code" });
        }

        // 2FA verified — create session
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Set CSRF token cookie so the client can send it on subsequent mutations
        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          user.id,
          "login_2fa_verified",
          {},
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string
        );

        return { success: true, userId: user.id };
      }),
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (user && user.email) {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await db.createPasswordResetToken(user.id, token, expiresAt);
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          const resetUrl = `${appUrl}/reset-password?token=${token}`;
          try {
            await sendPasswordResetEmail({
              toEmail: user.email,
              resetUrl,
              expiresInHours: 24,
            });
          } catch (emailError) {
            logger.error({ err: emailError }, "[Auth] Failed to send password reset email");
          }
        }
        return {
          success: true,
          message: "If an account exists, a reset email has been sent",
        };
      }),
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string().min(1),
          newPassword: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const resetToken = await db.getPasswordResetToken(input.token);
        if (!resetToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or expired token",
          });
        }
        if (new Date() > new Date(resetToken.expiresAt)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token has expired",
          });
        }
        if (resetToken.usedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token has already been used",
          });
        }
        const hashedPassword = hashPassword(input.newPassword);
        await db.updateUserPassword(resetToken.userId, hashedPassword);
        await db.markPasswordResetTokenUsed(resetToken.id);
        await db.revokeAllUserSessions(resetToken.userId);
        await db.createAuditLogEntry(
          resetToken.userId,
          "password_reset_completed",
          {},
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string
        );
        return {
          success: true,
          message: "Password has been reset successfully",
        };
      }),
  }),
  settings: settingsRouter,
  collections: collectionsRouter,
  scanning: scanningRouter,
  shadowAPI: shadowAPIRouter,
  tokenAnalytics: tokenAnalyticsRouter,
  killSwitch: killSwitchRouter,
  compliance: complianceRouter,
  team: teamRouter,
  onboarding: onboardingRouter,
  dashboard: dashboardRouter,
  riskScore: riskScoreRouter,
  vscodeExtension: vscodeExtensionRouter,
  admin: adminRouter,
  payment: paymentsRouter,
  webhooks: webhooksRouter,
  mcpGovernance: mcpGovernanceRouter,
  runtimeGovernance: runtimeGovernanceRouter,
  socTwo: socTwoRouter,
  policies: policiesRouter,
  alerts: alertsRouter,
  dataExport: dataExportRouter,
  apiDocs: apiDocsRouter,
  sso: ssoRouter,
  workspaces: workspacesRouter,
  shadowAiDetection: shadowAiDetectionRouter,
  research: researchRouter,
  telemetry: telemetryRouter,
});

// Register the appRouter with the apiDocs introspector so its `spec`
// procedure can walk the live router. We do this here instead of via
// dynamic import inside apiDocs.ts to avoid a tRPC type cycle that
// breaks react-query inference on the client.
setAppRouterForDocs(appRouter);

export type AppRouter = typeof appRouter;
