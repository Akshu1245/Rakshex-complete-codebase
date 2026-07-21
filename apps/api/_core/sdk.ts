import {
  AXIOS_TIMEOUT_MS,
  COOKIE_NAME,
  ONE_YEAR_MS,
  ACCESS_TOKEN_COOKIE,
} from "@rakshex/shared-types/const";
import { ForbiddenError, HttpError } from "@rakshex/shared-types";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@rakshex/database";
import * as db from "../db";
import { ENV } from "./env";
import { logger } from "./logger";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
import { verifyAccessToken } from "./tokens";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    logger.info({ baseURL: ENV.oAuthServerUrl }, "[OAuth] Initialized");
    if (!ENV.oAuthServerUrl) {
      logger.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable.",
      );
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(code: string, state: string): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);

    return data;
  }

  async getUserInfoByToken(token: ExchangeTokenResponse): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(GET_USER_INFO_PATH, {
      accessToken: token.accessToken,
    });

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined,
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(platforms.filter((p): p is string => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(data.platforms, data.platform ?? null);
    return {
      ...data,
      platform: loginMethod,
      loginMethod,
    };
  }

  private extractApiKey(req: Request): string | null {
    const header = req.headers["x-api-key"];
    if (typeof header === "string" && header.trim().length > 0) {
      return header.trim();
    }
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (token.length > 0 && token.startsWith("dp_")) {
        return token;
      }
    }
    return null;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      logger.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        logger.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      logger.warn({ err: String(error) }, "[Auth] Session verification failed");
      return null;
    }
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload,
    );

    const loginMethod = this.deriveLoginMethod(data.platforms, data.platform ?? null);
    return {
      ...data,
      platform: loginMethod,
      loginMethod,
    };
  }

  async authenticateRequest(req: Request): Promise<User> {
    // API key flow (VS Code extension, CLI, CI scanners). Checked before
    // cookie auth so headless clients never hit the OAuth sync path.
    const apiKey = this.extractApiKey(req);
    if (apiKey) {
      // Prefer workspace-scoped multi-key table (hashed, revocable, scoped)
      try {
        const { validateWorkspaceApiKey } = await import("../services/workspaceApiKeys");
        const validated = await validateWorkspaceApiKey(apiKey, {
          ip: req.ip ?? (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim(),
        });
        if (validated) {
          const user = await db.getUserById(validated.userId);
          if (user) {
            (user as any).__apiKeyAuth = {
              keyId: validated.keyId,
              workspaceId: validated.workspaceId,
              scopes: validated.scopes,
            };
            return user;
          }
        }
      } catch {
        /* fall through to legacy */
      }
      // Legacy single-key on users table
      const user = await db.getUserByApiKey(apiKey);
      if (!user) {
        throw ForbiddenError("Invalid API key");
      }
      return user;
    }

    // Regular authentication flow
    const cookies = this.parseCookies(req.headers.cookie);

    // Try the new access_token cookie first (dual-token auth)
    const accessTokenCookie = cookies.get(ACCESS_TOKEN_COOKIE);
    if (accessTokenCookie) {
      try {
        const payload = await verifyAccessToken(accessTokenCookie);
        // Bind JWT to server-side session so logout/revoke invalidates tokens
        const session = await db.getActiveUserSessionById(payload.sessionId);
        if (!session || session.userId !== payload.userId) {
          throw ForbiddenError("Session revoked or expired");
        }
        const user = await db.getUserById(payload.userId);
        if (!user) {
          throw ForbiddenError("User not found");
        }
        return user;
      } catch (err) {
        // Revoked/missing session must not fall through to legacy cookie auth
        if (err instanceof HttpError && err.statusCode === 403) {
          throw err;
        }
        // Fall through to legacy app_session_id
        logger.warn("[Auth] Access token invalid, falling back to legacy session");
      }
    }

    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      if (!sessionCookie) {
        throw ForbiddenError("Invalid session");
      }
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie);
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        logger.error({ err: error }, "[Auth] Failed to sync user from OAuth");
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
