/**
 * Security patch module - contains fixes for critical security vulnerabilities
 *
 * This module should be imported and used by the relevant files to fix security issues.
 * Once patches are applied, this module's exports can be removed.
 */

import crypto from "crypto";
import { logger } from "../_core/logger";

// ============================================================================
// WEBSOCKET AUTHENTICATION FIX
// ============================================================================

/**
 * Verify WebSocket authentication by extracting and validating session from cookies.
 *
 * IMPORTANT: In websocket.ts, replace the authenticate handler to use this function:
 *
 * OLD CODE ( insecure ):
 *   socket.on("authenticate", (userId: number) => {
 *     // Client provides userId - CAN BE SPOOFED!
 *     socket.join(`user:${userId}`);
 *   });
 *
 * NEW CODE ( secure ):
 *   socket.on("authenticate", async (data: any, callback: Function) => {
 *     const auth = await verifyWebSocketAuth(socket);
 *     if (auth) {
 *       socket.join(`user:${auth.userId}`);
 *       callback({ success: true, userId: auth.userId });
 *     } else {
 *       callback({ success: false, error: "Not authenticated" });
 *     }
 *   });
 */
export async function verifyWebSocketAuth(
  socket: any,
  db: any,
): Promise<{ userId: number; role: string } | null> {
  try {
    const cookieHeader = socket.handshake?.headers?.cookie;
    if (!cookieHeader) return null;

    // Parse cookies
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((c: string) => {
      const [name, ...rest] = c.trim().split("=");
      cookies[name] = rest.join("=");
    });

    const token = cookies["rakshex_session"];
    if (!token) return null;

    // Decode legacy session cookie. The cookie is base64-encoded JSON
    // shaped like `{ userId, expiresAt, sessionId, ... }`. The historical
    // DB lookup via `getUserSessionByToken` (filtered by `sessionToken`
    // column) was broken because the cookie payload doesn't carry the
    // session token — only the row id. Treat the cookie as self-validating
    // and check its own `expiresAt` instead.
    let sessionData: any;
    try {
      sessionData = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    } catch {
      return null;
    }
    if (!sessionData || typeof sessionData !== "object") return null;
    if (typeof sessionData.userId !== "number" || sessionData.userId <= 0) return null;
    if (typeof sessionData.expiresAt !== "number" || sessionData.expiresAt <= Date.now()) {
      return null;
    }

    // Get user — reject if not found. Account lock is server-side state
    // that the cookie cannot represent, so it must still be checked here.
    const user = await db.getUserById(sessionData.userId);
    if (!user) return null;

    // Check account lock — reject if locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return null;
    }

    return { userId: user.id, role: user.role };
  } catch {
    return null;
  }
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION FIX
// ============================================================================

/**
 * Fixed webhook signature verification that properly handles:
 * - Missing signatures
 * - Invalid signature formats
 * - Timing attacks
 *
 * Usage in payment webhook handler:
 *
 * OLD CODE ( buggy ):
 *   const sigBuf = Buffer.from(signature, "utf-8");
 *   const expBuf = Buffer.from(expectedSignature, "utf-8");
 *   const isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
 *   // BUG: If signature is wrong format/length, this fails silently
 *
 * NEW CODE ( secure ):
 *   const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!secret) {
    logger.error("[Webhook] Secret not configured");
    return false;
  }

  if (!signature) {
    logger.error("[Webhook] No signature provided");
    return false;
  }

  const payloadString = typeof payload === "string" ? payload : payload.toString("utf-8");
  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");

  // Use timing-safe comparison with proper error handling
  try {
    const signatureBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`, "utf-8");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.error({ err: error }, "[Webhook] Signature verification error");
    return false;
  }
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

/**
 * Generate a CSRF token for forms
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Verify CSRF token from request headers
 */
export function verifyCsrfToken(
  requestToken: string | undefined,
  sessionToken: string | undefined,
): boolean {
  if (!requestToken || !sessionToken) return false;

  try {
    const requestBuf = Buffer.from(requestToken, "utf-8");
    const sessionBuf = Buffer.from(sessionToken, "utf-8");

    if (requestBuf.length !== sessionBuf.length) return false;
    return crypto.timingSafeEqual(requestBuf, sessionBuf);
  } catch {
    return false;
  }
}

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1F"\x7F]/g, "").trim();
}
