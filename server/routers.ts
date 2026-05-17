import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "@shared/const";
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
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from "./_core/tokens";
import { redis } from "./_core/cache";

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
import { policiesRouter, policyRulesRouter } from "./api/policies";
import { alertsRouter } from "./api/alerts";
import { approvalsRouter } from "./api/approvals";
import { dataExportRouter } from "./api/dataExport";
import { apiDocsRouter, setAppRouterForDocs } from "./api/apiDocs";
import { ssoRouter } from "./api/sso";
import { workspacesRouter } from "./api/workspaces";
import { apiKeysRouter } from "./api/apiKeys";
import { researchRouter } from "./api/research";
import { telemetryRouter } from "./api/telemetry";
import { analyticsRouter } from "./api/analytics";
import { auditRouter } from "./api/audit";
import { costRouter } from "./api/cost";
import { fixRouter } from "./api/fix";
import { githubRouter } from "./api/github";
import { agentGuardRouter } from "./api/agentGuard";
import { ensurePersonalWorkspace } from "./services/workspaceContext";
import { logger } from "./_core/logger";

// ============================================================================
// MAIN ROUTER - merges all individual routers
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(ACCESS_TOKEN_COOKIE, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(REFRESH_TOKEN_COOKIE, { ...cookieOptions, maxAge: -1 });
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
      const sessions = await db.getUserSessions(ctx.user.id);
      await db.revokeAllUserSessions(ctx.user.id);
      // Redis fast-path revocation for all active sessions
      for (const s of sessions) {
        if (s.refreshTokenHash) {
          try {
            await redis.set(`revoked:${s.refreshTokenHash}`, "1", "EX", 3600);
          } catch {
            // Redis down — DB revoke is sufficient
          }
        }
      }
      await db.createAuditLogEntry(
        ctx.user.id,
        "logout_all_sessions",
        {},
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(ACCESS_TOKEN_COOKIE, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(REFRESH_TOKEN_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    /**
     * List the active sessions for the calling user — feeds the
     * "Your devices" panel so users can spot a session they don't
     * recognize and revoke it.
     */
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await db.getUserSessions(ctx.user.id);
      return sessions.map((s) => ({
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
        const sessions = await db.getUserSessions(ctx.user.id);
        const owned = sessions.find((s) => s.id === input.sessionId);
        if (!owned) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found",
          });
        }
        await db.revokeUserSession(input.sessionId);
        // Redis fast-path revocation
        if (owned.refreshTokenHash) {
          try {
            await redis.set(`revoked:${owned.refreshTokenHash}`, "1", "EX", 3600);
          } catch {
            // Redis down — DB revoke is sufficient
          }
        }
        await db.createAuditLogEntry(
          ctx.user.id,
          "session_revoked",
          { sessionId: input.sessionId },
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string,
        );
        return { success: true };
      }),
    signup: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(8).max(128),
          name: z.string().min(1).max(120),
        }),
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

        // First user auto-promotion
        try {
          const driver = await db.getDb();
          if (driver) {
            const rows = await driver.select({ n: sql<number>`count(*)` }).from(users);
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

        // Auto-create the user's personal workspace
        try {
          await ensurePersonalWorkspace(created.id, input.name.trim());
        } catch (err) {
          logger.warn(
            { err: err, userId: created.id },
            "[signup] personal workspace creation skipped",
          );
        }

        // Create session with dual tokens
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

        const { id: sessionId } = await db.createUserSession(
          created.id,
          refreshTokenHash,
          refreshTokenHash,
          ctx.req.ip ?? null,
          (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt,
        );

        const accessToken = await generateAccessToken(created.id, sessionId);
        const cookieOptions = getSessionCookieOptions(ctx.req);

        ctx.res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
          ...cookieOptions,
          maxAge: ACCESS_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
        });

        ctx.res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
          ...cookieOptions,
          maxAge: REFRESH_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
          path: "/trpc/auth.refreshToken",
        });

        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          created.id,
          "signup_email",
          { email: normalizedEmail },
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string,
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
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const user = await db.getUserByEmail(normalizedEmail);

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
          const { attempts, lockedUntil } = await db.incrementFailedLoginAttempts(user.id);
          await db.createAuditLogEntry(
            user.id,
            "login_failed",
            { email: normalizedEmail, attempts, lockedUntil },
            ctx.req.ip,
            ctx.req.headers["user-agent"] as string,
          );
          throw invalidCredentials;
        }

        await db.resetFailedLoginAttempts(user.id);

        // Check 2FA
        const userWithTotp = await db.getUserById(user.id);
        if (userWithTotp && (userWithTotp as any).totpSecret) {
          return { success: false, requires2FA: true, userId: user.id };
        }

        // Create session with dual tokens
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

        const { id: sessionId } = await db.createUserSession(
          user.id,
          refreshTokenHash,
          refreshTokenHash,
          ctx.req.ip ?? null,
          (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt,
        );

        const accessToken = await generateAccessToken(user.id, sessionId);
        const cookieOptions = getSessionCookieOptions(ctx.req);

        ctx.res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
          ...cookieOptions,
          maxAge: ACCESS_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
        });

        ctx.res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
          ...cookieOptions,
          maxAge: REFRESH_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
          path: "/trpc/auth.refreshToken",
        });

        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          user.id,
          "login_email",
          { email: normalizedEmail },
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string,
        );

        return { success: true, userId: user.id };
      }),
    /**
     * Refresh token rotation: validates the refresh token from the httpOnly
     * cookie, issues a new access token, and rotates the refresh token
     * (invalidate old, issue new in an atomic transaction).
     */
    refreshToken: publicProcedure.mutation(async ({ ctx }) => {
      const cookies = ctx.req.headers.cookie;
      if (!cookies) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No cookies present" });
      }

      const parsed = Object.fromEntries(
        cookies.split(";").map((c: string) => {
          const [k, ...v] = c.trim().split("=");
          return [k, v.join("=")];
        }),
      );

      const rawToken = parsed[REFRESH_TOKEN_COOKIE];
      if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing refresh token" });
      }

      const tokenHash = hashRefreshToken(rawToken);

      // Fast-path: check Redis revocation list
      try {
        const revoked = await redis.get(`revoked:${tokenHash}`);
        if (revoked) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token has been revoked" });
        }
      } catch {
        // Redis down — fall through to DB check
      }

      // DB lookup
      const session = await db.getUserSessionByRefreshTokenHash(tokenHash);
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh token" });
      }

      // Revoke the old refresh token
      await db.rotateRefreshToken(session.id, "");

      // Issue new refresh token (rotation)
      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

      await db.rotateRefreshToken(session.id, newRefreshTokenHash);

      // Issue new access token
      const accessToken = await generateAccessToken(session.userId, session.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE_MS,
        sameSite: "strict",
      });

      ctx.res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
        sameSite: "strict",
        path: "/trpc/auth.refreshToken",
      });

      await db.createAuditLogEntry(
        session.userId,
        "token_refreshed",
        { sessionId: session.id },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      return { success: true };
    }),
    /**
     * Verify 2FA code during login. Creates session with dual tokens on success.
     */
    verify2FALogin: publicProcedure
      .input(
        z.object({
          userId: z.string().length(1).max(100),
          code: z
            .string()
            .length(6)
            .regex(/^\d{6}$/),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(Number(input.userId));
        if (!user || !(user as any).totpSecret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "2FA not required for this account",
          });
        }

        if (!verifyTotpCode((user as any).totpSecret, input.code)) {
          await db.createAuditLogEntry(
            user.id,
            "login_2fa_failed",
            {},
            ctx.req.ip,
            ctx.req.headers["user-agent"] as string,
          );
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid 2FA code" });
        }

        // Create session with dual tokens
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

        const { id: sessionId } = await db.createUserSession(
          user.id,
          refreshTokenHash,
          refreshTokenHash,
          ctx.req.ip ?? null,
          (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt,
        );

        const accessToken = await generateAccessToken(user.id, sessionId);
        const cookieOptions = getSessionCookieOptions(ctx.req);

        ctx.res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
          ...cookieOptions,
          maxAge: ACCESS_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
        });

        ctx.res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
          ...cookieOptions,
          maxAge: REFRESH_TOKEN_MAX_AGE_MS,
          sameSite: "strict",
          path: "/trpc/auth.refreshToken",
        });

        setCsrfCookie(ctx.res);

        await db.createAuditLogEntry(
          user.id,
          "login_2fa_verified",
          {},
          ctx.req.ip,
          ctx.req.headers["user-agent"] as string,
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
        }),
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
          ctx.req.headers["user-agent"] as string,
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
  policyRules: policyRulesRouter,
  alerts: alertsRouter,
  approvals: approvalsRouter,
  dataExport: dataExportRouter,
  apiDocs: apiDocsRouter,
  sso: ssoRouter,
  workspaces: workspacesRouter,
  apiKeys: apiKeysRouter,
  shadowAiDetection: shadowAiDetectionRouter,
  research: researchRouter,
  telemetry: telemetryRouter,
  analytics: analyticsRouter,
  audit: auditRouter,
  cost: costRouter,
  fix: fixRouter,
  github: githubRouter,
  agentGuard: agentGuardRouter,
});

// Register the appRouter with the apiDocs introspector so its `spec`
// procedure can walk the live router. We do this here instead of via
// dynamic import inside apiDocs.ts to avoid a tRPC type cycle that
// breaks react-query inference on the client.
setAppRouterForDocs(appRouter);

export type AppRouter = typeof appRouter;
