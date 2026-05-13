import { redis } from "./cache";
import * as db from "../db";

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  db: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  uptime: number;
  timestamp: string;
  version: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const uptime = process.uptime();

  // Check database connection
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    // Simple query to check DB connection
    await db.getUserById(1);
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  // Check Redis connection
  let redisStatus: "connected" | "disconnected" = "disconnected";
  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "disconnected";
  }

  const status: "ok" | "degraded" | "error" =
    dbStatus === "connected" && redisStatus === "connected"
      ? "ok"
      : dbStatus === "connected" || redisStatus === "connected"
        ? "degraded"
        : "error";

  return {
    status,
    db: dbStatus,
    redis: redisStatus,
    uptime,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  };
}

// Express health check handler
export async function healthCheckHandler(req: any, res: any) {
  const health = await getHealthStatus();
  const statusCode =
    health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;
  res.status(statusCode).json(health);
}
