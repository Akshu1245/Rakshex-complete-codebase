/**
 * WebSocket Manager for real-time updates
 * Broadcasts cost updates, kill switch events, and scan results to connected clients
 */

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyWebSocketAuth } from "./utils/security";
import { verifyAccessToken } from "./_core/tokens";
import * as db from "./db";
import { logger } from "./_core/logger";
import { ENV } from "./_core/env";

type EventType = "cost_update" | "kill_switch" | "scan_complete" | "security_event";

interface BroadcastMessage {
  type: EventType;
  data: any;
  userId?: number; // If provided, only send to this user
}

/**
 * Decode and self-validate a `rakshex_session` cookie value.
 *
 * The legacy cookie is base64-encoded JSON of the shape
 * `{ userId: number; expiresAt: number; sessionId: string; ... }`. We
 * historically tried to look it up in the DB via `getUserSessionByToken`
 * (filtered by the `sessionToken` column), but the cookie payload doesn't
 * carry the session token — only the row id. That lookup always returned
 * null, silently breaking legacy-session WS auth.
 *
 * The cookie is self-validating: it has its own `expiresAt` and `userId`.
 * If those are present and unexpired, trust it. JWT (`access_token`) remains
 * the primary auth path; this is only a fallback for older clients.
 */
function decodeLegacySessionCookie(
  rawCookie: string,
): { userId: number; expiresAt: number } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(rawCookie), "base64").toString("utf-8"),
    );
    if (!decoded || typeof decoded !== "object") return null;
    if (typeof decoded.userId !== "number" || decoded.userId <= 0) return null;
    if (typeof decoded.expiresAt !== "number") return null;
    if (decoded.expiresAt <= Date.now()) return null;
    return { userId: decoded.userId, expiresAt: decoded.expiresAt };
  } catch {
    return null;
  }
}

class WebSocketManager {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<number, Set<string>>();

  initialize(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: ENV.frontendUrl,
        credentials: true,
      },
      path: "/ws",
    });

    // JWT validation on upgrade handshake — reject unauthenticated connections
    // before they can emit or receive any events.
    this.io.use(async (socket, next) => {
      try {
        // Try query param first (for clients that send token explicitly)
        const queryToken = socket.handshake.query?.token;
        let token: string | undefined;
        if (typeof queryToken === "string" && queryToken.length > 0) {
          token = queryToken;
        }

        // Fallback to access_token cookie
        if (!token) {
          const cookieHeader = socket.handshake.headers?.cookie;
          if (cookieHeader) {
            const match = cookieHeader.match(/access_token=([^;]+)/);
            if (match) token = decodeURIComponent(match[1]);
          }
        }

        // Fallback to rakshex_session cookie (legacy session support)
        if (!token) {
          const cookieHeader = socket.handshake.headers?.cookie;
          if (cookieHeader) {
            const match = cookieHeader.match(/rakshex_session=([^;]+)/);
            if (match) {
              const session = decodeLegacySessionCookie(match[1]);
              if (session) {
                socket.data.userId = session.userId;
                return next();
              }
            }
          }
        }

        if (!token) {
          return next(new Error("Authentication required"));
        }

        const payload = await verifyAccessToken(token);
        socket.data.userId = payload.userId;
        next();
      } catch {
        next(new Error("Invalid or expired token"));
      }
    });

    this.io.on("connection", (socket: Socket) => {
      // Authenticate against the session cookie rather than client-supplied userId
      // so clients cannot spoof another user's id.
      socket.on("authenticate", async (_payload, ack?: (resp: unknown) => void) => {
        const auth = await verifyWebSocketAuth(socket, db);
        if (!auth) {
          ack?.({ success: false, error: "Not authenticated" });
          socket.disconnect(true);
          return;
        }
        const userId = auth.userId;
        if (!this.connectedUsers.has(userId)) {
          this.connectedUsers.set(userId, new Set());
        }
        this.connectedUsers.get(userId)!.add(socket.id);
        socket.join(`user:${userId}`);
        logger.info(`[WebSocket] User ${userId} connected: ${socket.id}`);
        ack?.({ success: true, userId });
      });

      socket.on("disconnect", () => {
        for (const [userId, socketIds] of Array.from(this.connectedUsers.entries())) {
          if (socketIds.has(socket.id)) {
            socketIds.delete(socket.id);
            if (socketIds.size === 0) {
              this.connectedUsers.delete(userId);
            }
            logger.info(`[WebSocket] User ${userId} disconnected: ${socket.id}`);
            break;
          }
        }
      });
    });

    logger.info("[WebSocket] Server initialized");

    // Periodically sweep and disconnect expired connections
    setInterval(() => {
      if (!this.io) return;
      this.io.sockets.sockets.forEach(async (socket) => {
        const cookieHeader = socket.handshake?.headers?.cookie;
        if (!cookieHeader) {
          socket.disconnect(true);
          return;
        }

        // 1. Check access_token expiration
        const matchToken = cookieHeader.match(/access_token=([^;]+)/);
        if (matchToken) {
          const token = decodeURIComponent(matchToken[1]);
          try {
            await verifyAccessToken(token);
          } catch {
            logger.info(
              { socketId: socket.id },
              "[WebSocket] Disconnecting due to expired access token",
            );
            socket.disconnect(true);
          }
          return;
        }

        // 2. Check rakshex_session cookie expiration (self-validating)
        const matchSession = cookieHeader.match(/rakshex_session=([^;]+)/);
        if (matchSession) {
          const session = decodeLegacySessionCookie(matchSession[1]);
          if (!session) {
            logger.info(
              { socketId: socket.id },
              "[WebSocket] Disconnecting due to expired or invalid session",
            );
            socket.disconnect(true);
          }
        }
      });
    }, 60000); // Check every 60 seconds
  }

  broadcast(message: BroadcastMessage) {
    if (!this.io) return;

    if (message.userId) {
      // Send to specific user
      this.io.to(`user:${message.userId}`).emit("message", message);
    } else {
      // Broadcast to all
      this.io.emit("message", message);
    }
  }

  // Convenience methods for common events
  broadcastCostUpdate(userId: number, cost: number, model: string, anomaly: boolean) {
    this.broadcast({
      type: "cost_update",
      data: {
        userId,
        cost,
        model,
        anomaly,
        timestamp: new Date().toISOString(),
      },
    });
  }

  broadcastKillSwitch(userId: number, reason: string, isActive: boolean) {
    this.broadcast({
      type: "kill_switch",
      data: { userId, reason, isActive, timestamp: new Date().toISOString() },
    });
  }

  broadcastScanStarted(userId: number, data: { scanId: string; collectionId: string }) {
    this.broadcast({
      type: "scan_complete", // Using scan_complete type with status 'started'
      data: {
        ...data,
        userId,
        status: "started",
        timestamp: new Date().toISOString(),
      },
      userId,
    });
  }

  broadcastScanComplete(
    userId: number,
    data: {
      scanId: string;
      collectionId: string;
      findingsCount: number;
      criticalCount: number;
      highCount: number;
    },
  ) {
    this.broadcast({
      type: "scan_complete",
      data: {
        ...data,
        userId,
        status: "completed",
        timestamp: new Date().toISOString(),
      },
      userId,
    });
  }

  broadcastSecurityEvent(userId: number, eventType: string, severity: string, details: string) {
    this.broadcast({
      type: "security_event",
      data: {
        userId,
        eventType,
        severity,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export const wsManager = new WebSocketManager();
