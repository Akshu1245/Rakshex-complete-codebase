/**
 * GitHub OAuth 2.0 Integration
 * Mirrors the Google OAuth flow: redirects to GitHub's consent screen,
 * exchanges the authorization code for an access token, fetches the user
 * profile + primary email, and creates a Rakshex session.
 * Falls back gracefully when GITHUB_CLIENT_ID is not configured.
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { parse as parseCookieHeader } from "cookie";
import axios from "axios";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { logger } from "./logger";
import { sdk } from "./sdk";
import { ENV } from "./env";

const STATE_COOKIE = "rakshex_gh_oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

function isGitHubConfigured(): boolean {
  return !!(ENV.githubClientId && ENV.githubClientSecret);
}

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/oauth/github/callback`;
}

async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
  try {
    const { data } = await axios.get<GitHubEmail[]>("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "rakshex",
      },
      timeout: 10000,
    });
    const primary = data.find((e) => e.primary && e.verified) ?? data.find((e) => e.verified);
    return primary?.email ?? null;
  } catch {
    return null;
  }
}

export function registerGitHubOAuthRoutes(app: Express) {
  /**
   * GET /api/oauth/github
   * Redirects the user to GitHub's OAuth consent screen.
   */
  app.get("/api/oauth/github", (req: Request, res: Response) => {
    if (!isGitHubConfigured()) {
      res.status(503).json({
        error: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      });
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: STATE_MAX_AGE_MS,
    });

    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: getRedirectUri(req),
      scope: "read:user user:email",
      state,
      allow_signup: "true",
    });

    res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  /**
   * GET /api/oauth/github/callback
   * Handles the authorization code from GitHub, exchanges it for an access
   * token, fetches the user profile, and creates a Rakshex session.
   */
  app.get("/api/oauth/github/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;
    const expectedState = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE];

    res.clearCookie(STATE_COOKIE);

    if (error) {
      logger.warn({ err: error }, "[GitHub OAuth] User denied access or error");
      res.redirect(302, "/?error=github_auth_denied");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code missing from GitHub callback" });
      return;
    }

    if (!state || !expectedState || state !== expectedState) {
      logger.warn("[GitHub OAuth] State mismatch — possible CSRF");
      res.redirect(302, "/?error=github_auth_failed");
      return;
    }

    if (!isGitHubConfigured()) {
      res.status(503).json({ error: "GitHub OAuth is not configured on the server." });
      return;
    }

    try {
      const { data: tokenData } = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: getRedirectUri(req),
        },
        {
          headers: { Accept: "application/json" },
          timeout: 10000,
        },
      );

      const accessToken: string | undefined = tokenData?.access_token;
      if (!accessToken) {
        throw new Error("No access token returned from GitHub");
      }

      const { data: profile } = await axios.get<GitHubUser>("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "rakshex",
        },
        timeout: 10000,
      });

      const email = profile.email ?? (await fetchPrimaryEmail(accessToken));
      const openId = `github:${profile.id}`;
      const name = profile.name ?? profile.login ?? "GitHub User";

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "github",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      logger.info({ user: email ?? openId }, "[GitHub OAuth] User signed in");
      res.redirect(302, "/");
    } catch (err) {
      logger.error({ err }, "[GitHub OAuth] Callback error");
      res.redirect(302, "/?error=github_auth_failed");
    }
  });
}
