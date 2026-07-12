import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS } from "@rakshex/shared-types/const";
import { ENV } from "./env";
import { logger } from "./logger";
import { SessionExpiredError } from "./errors";

type AccessTokenPayload = {
  userId: number;
  sessionId: string;
  type: "access";
};

type RefreshTokenPayload = {
  sessionId: string;
  type: "refresh";
};

function getSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}

/**
 * Generate a short-lived access token JWT (15 min).
 */
export async function generateAccessToken(userId: number, sessionId: string): Promise<string> {
  const now = Date.now();
  const exp = Math.floor((now + ACCESS_TOKEN_MAX_AGE_MS) / 1000);

  return new SignJWT({
    userId,
    sessionId,
    type: "access" as const,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(exp)
    .setIssuedAt(Math.floor(now / 1000))
    .sign(getSecret());
}

/**
 * Generate a cryptographically random refresh token (64-byte hex string).
 * The caller must hash this before storing.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Verify an access token and return the typed payload.
 * Throws SessionExpiredError if invalid/expired.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const { userId, sessionId, type } = payload as Record<string, unknown>;

    if (type !== "access" || typeof userId !== "number" || typeof sessionId !== "string") {
      logger.warn("[Tokens] Access token payload missing required fields");
      throw new SessionExpiredError("Invalid token structure");
    }

    return { userId, sessionId, type: "access" };
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    logger.warn({ err: String(err) }, "[Tokens] Access token verification failed");
    throw new SessionExpiredError("Access token expired or invalid");
  }
}

/**
 * SHA-256 hash a refresh token for storage. Never store raw tokens.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Maximum age for refresh tokens in milliseconds.
 */
export const REFRESH_TOKEN_MAX_MS = REFRESH_TOKEN_MAX_AGE_MS;

/**
 * Check if a date is in the past (expired).
 */
export function isExpired(date: Date): boolean {
  return Date.now() > date.getTime();
}
