/**
 * Google OAuth 2.0 with state + PKCE (S256).
 */
import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "@rakshex/shared-types/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { AuthError } from "./errors";
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
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "./tokens";

let googleClient: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client {
  if (!googleClient) {
    googleClient = new OAuth2Client(ENV.googleClientId, ENV.googleClientSecret);
  }
  return googleClient;
}

function isGoogleConfigured(): boolean {
  return !!(ENV.googleClientId && ENV.googleClientSecret);
}

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/oauth/google/callback`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/oauth/google", async (req: Request, res: Response) => {
    if (!isGoogleConfigured()) {
      res.status(503).json({
        error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
      return;
    }

    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);
    const redirectAfter = typeof req.query.redirect === "string" ? req.query.redirect : undefined;

    await storeOAuthPending(state, {
      provider: "google",
      codeVerifier,
      redirectAfter,
      createdAt: Date.now(),
    });

    const client = getGoogleClient();
    const redirectUri = getRedirectUri(req);

    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      redirect_uri: redirectUri,
      prompt: "select_account",
      state,
      code_challenge: codeChallenge,
      // PKCE S256 — cast around google-auth-library's narrow enum typing
      ...({ code_challenge_method: "S256" } as Record<string, string>),
    } as Parameters<OAuth2Client["generateAuthUrl"]>[0]);

    res.redirect(302, authUrl);
  });

  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      logger.warn({ err: error }, "[Google OAuth] User denied access or error");
      res.redirect(302, "/login?error=google_auth_denied");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code missing from Google callback" });
      return;
    }

    const pending = await consumeOAuthPending(state, "google");
    if (!pending) {
      res.redirect(302, "/login?error=invalid_oauth_state");
      return;
    }

    if (!isGoogleConfigured()) {
      res.status(503).json({ error: "Google OAuth is not configured on the server." });
      return;
    }

    try {
      const client = getGoogleClient();
      const redirectUri = getRedirectUri(req);

      const { tokens } = await client.getToken({
        code,
        redirect_uri: redirectUri,
        codeVerifier: pending.codeVerifier,
      });
      client.setCredentials(tokens);

      if (!tokens.id_token) {
        throw new AuthError("No ID token returned from Google", {
          safeMessage: "Could not sign in with Google. Please try again.",
        });
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: ENV.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new AuthError("Invalid Google ID token payload", {
          safeMessage: "Could not sign in with Google. Please try again.",
        });
      }

      const openId = `google:${payload.sub}`;
      const name = payload.name ?? payload.email?.split("@")[0] ?? "Google User";
      const email = payload.email ?? null;

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.redirect(302, "/login?error=google_auth_failed");
        return;
      }

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

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.cookie("session", sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      await db.createAuditLogEntry(
        user.id,
        "login_google",
        { email },
        req.ip,
        req.headers["user-agent"] as string,
      );

      logger.info({ user: email ?? openId }, "[Google OAuth] User signed in");
      res.redirect(302, pending.redirectAfter || "/");
    } catch (err) {
      logger.error({ err }, "[Google OAuth] Callback error");
      res.redirect(302, "/login?error=google_auth_failed");
    }
  });
}
