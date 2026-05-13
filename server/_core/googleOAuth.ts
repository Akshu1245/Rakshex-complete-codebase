/**
 * Google OAuth 2.0 Integration
 * Uses google-auth-library for secure token exchange and user profile retrieval.
 * Falls back gracefully when GOOGLE_CLIENT_ID is not configured.
 */

import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { AuthError } from "./errors";
import { logger } from "./logger";
import { sdk } from "./sdk";
import { ENV } from "./env";

let googleClient: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client {
  if (!googleClient) {
    googleClient = new OAuth2Client(
      ENV.googleClientId,
      ENV.googleClientSecret
      // redirectUri is set per-request
    );
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
  /**
   * GET /api/oauth/google
   * Redirects the user to Google's OAuth consent screen.
   */
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    if (!isGoogleConfigured()) {
      res.status(503).json({
        error:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
      return;
    }

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
    });

    res.redirect(302, authUrl);
  });

  /**
   * GET /api/oauth/google/callback
   * Handles the authorization code from Google, exchanges it for tokens,
   * fetches user profile, and creates a DevPulse session.
   */
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      logger.warn({ err: error }, "[Google OAuth] User denied access or error");
      res.redirect(302, "/?error=google_auth_denied");
      return;
    }

    if (!code) {
      res
        .status(400)
        .json({ error: "Authorization code missing from Google callback" });
      return;
    }

    if (!isGoogleConfigured()) {
      res
        .status(503)
        .json({ error: "Google OAuth is not configured on the server." });
      return;
    }

    try {
      const client = getGoogleClient();
      const redirectUri = getRedirectUri(req);

      // Exchange code for tokens
      const { tokens } = await client.getToken({
        code,
        redirect_uri: redirectUri,
      });
      client.setCredentials(tokens);

      // Verify the ID token and extract user info
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

      // Use Google's `sub` (subject) as the stable openId
      const openId = `google:${payload.sub}`;
      const name =
        payload.name ?? payload.email?.split("@")[0] ?? "Google User";
      const email = payload.email ?? null;

      // Upsert the user in our DB
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create our own JWT session (same mechanism as Manus login)
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      logger.info(
        { user: email ?? openId },
        "[Google OAuth] User signed in"
      );
      res.redirect(302, "/");
    } catch (err) {
      logger.error({ err }, "[Google OAuth] Callback error");
      res.redirect(302, "/?error=google_auth_failed");
    }
  });
}
