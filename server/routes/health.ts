/**
 * Health check routes for production monitoring.
 */

import { Router, type Request, type Response } from "express";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { redis } from "../_core/cache";

const VERSION = process.env.APP_VERSION ?? "0.1.0";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  let dbStatus: "ok" | "error" = "ok";
  let redisStatus: "ok" | "error" = "ok";

  try {
    const db = await getDb();
    if (!db) dbStatus = "error";
    else {
      await db.execute({ sql: "SELECT 1", params: [] } as never);
    }
  } catch {
    dbStatus = "error";
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = "error";
  }

  const status = dbStatus === "ok" && redisStatus === "ok" ? "ok" : "degraded";
  const statusCode = status === "ok" ? 200 : 503;

  res.status(statusCode).json({
    status,
    db: dbStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    version: VERSION,
  });
});

healthRouter.get("/robots.txt", (_req: Request, res: Response) => {
  res.type("text/plain");
  res.send("User-agent: *\nDisallow: /\n");
});

healthRouter.get("/health/ready", async (_req: Request, res: Response) => {
  let dbStatus: "ok" | "error" = "ok";
  let redisStatus: "ok" | "error" = "ok";

  try {
    const db = await getDb();
    if (!db) dbStatus = "error";
    else await db.execute({ sql: "SELECT 1", params: [] } as never);
  } catch {
    dbStatus = "error";
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = "error";
  }

  const allOk = dbStatus === "ok" && redisStatus === "ok";
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "not ready",
    db: dbStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    version: VERSION,
  });
});
