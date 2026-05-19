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

        // Fallback to devpulse_session cookie (legacy session support)
        if (!token) {
          const cookieHeader = socket.handshake.headers?.cookie;
          if (cookieHeader) {
            const match = cookieHeader.match(/devpulse_session=([^;]+)/);
            if (match) {
              const sessionData = JSON.parse(
                Buffer.from(decodeURIComponent(match[1]), "base64").toString("utf-8"),
              );
              if (sessionData?.sessionId) {
                const session = await db.getUserSessionByToken(sessionData.sessionId);
                if (session) {
                  socket.data.userId = session.userId;
                  return next();
                }
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
