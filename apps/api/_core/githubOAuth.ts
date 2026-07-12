/**
 * GitHub OAuth 2.0 with state + PKCE (S256).
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@rakshex/shared-types/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { logger } from "./logger";
import { sdk } from "./sdk";
import { ENV } from "./env";
import {
  consumeOAuthPending,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  storeOAuthPending,
} from "../services/oauthPkce";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "@rakshex/shared-types/const";
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "./tokens";

function isGitHubConfigured(): boolean {
  return !!(ENV.githubClientId && ENV.githubClientSecret);
}

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/oauth/github/callback`;
}

export function registerGitHubOAuthRoutes(app: Express) {
  app.get("/api/oauth/github", async (req: Request, res: Response) => {
    if (!isGitHubConfigured()) {
      res.status(503).json({
        error: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      });
      return;
    }

    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);
    const redirectAfter = typeof req.query.redirect === "string" ? req.query.redirect : undefined;

    await storeOAuthPending(state, {
      provider: "github",
      codeVerifier,
      redirectAfter,
      createdAt: Date.now(),
    });

    const redirectUri = getRedirectUri(req);
    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get("/api/oauth/github/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      logger.warn({ err: error }, "[GitHub OAuth] User denied access");
      res.redirect(302, "/login?error=github_auth_denied");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code missing" });
      return;
    }

    const pending = await consumeOAuthPending(state, "github");
    if (!pending) {
      res.redirect(302, "/login?error=invalid_oauth_state");
      return;
    }

    if (!isGitHubConfigured()) {
      res.status(503).json({ error: "GitHub OAuth is not configured" });
      return;
    }

    try {
      const redirectUri = getRedirectUri(req);
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: redirectUri,
          code_verifier: pending.codeVerifier,
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenJson.access_token) {
        logger.error({ err: tokenJson.error }, "[GitHub OAuth] Token exchange failed");
        res.redirect(302, "/login?error=github_auth_failed");
        return;
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Rakshex",
        },
      });
      const ghUser = (await userRes.json()) as {
        id: number;
        login: string;
        name?: string;
        email?: string | null;
      };

      let email = ghUser.email ?? null;
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Rakshex",
          },
        });
        if (emailsRes.ok) {
          const emails = (await emailsRes.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primary =
            emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
          email = primary?.email ?? null;
        }
      }

      const openId = `github:${ghUser.id}`;
      const name = ghUser.name ?? ghUser.login ?? "GitHub User";

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "github",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.redirect(302, "/login?error=github_auth_failed");
        return;
      }

      // Dual-token session
      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
      const { id: sessionId } = await db.createUserSession(
        user.id,
        refreshTokenHash,
        refreshTokenHash,
        req.ip ?? null,
        (req.headers["user-agent"] as string) ?? null,
        expiresAt,
      );
      const accessToken = await generateAccessToken(user.id, sessionId);
      const cookieOptions = getSessionCookieOptions(req);

      res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE_MS,
        sameSite: "strict",
      });
      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
        sameSite: "strict",
        path: "/trpc/auth.refreshToken",
      });

      // Legacy cookie for middleware compatibility
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.cookie("session", sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      await db.createAuditLogEntry(
        user.id,
        "login_github",
        { email },
        req.ip,
        req.headers["user-agent"] as string,
      );

      logger.info({ user: email ?? openId }, "[GitHub OAuth] User signed in");
      res.redirect(302, pending.redirectAfter || "/");
    } catch (err) {
      logger.error({ err }, "[GitHub OAuth] Callback error");
      res.redirect(302, "/login?error=github_auth_failed");
    }
  });
}
