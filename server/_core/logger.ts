/**
 * Enterprise structured logger.
 *
 * Wraps Pino with:
 *   - JSON output in production, pretty-print in dev
 *   - Centralized PII redaction for common secret-y field names
 *   - Per-request child loggers (request ID + correlation ID + user ID)
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info({ userId: 42 }, "user logged in");
 *
 *   // Per-request:
 *   const log = req.log; // attached by createRequestLogger middleware
 *   log.warn({ resource: "scan" }, "scan rate-limit warn");
 *
 * Logs are designed to be ingested by any structured-log aggregator
 * (Datadog, Loki, CloudWatch). The `requestId` field is the primary
 * correlation key and is also echoed back to clients via the
 * `X-Request-Id` response header so they can attach it to bug reports.
 */
import crypto from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import pino, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  formatters: {
    level: label => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || "devpulse",
    env: process.env.NODE_ENV || "development",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname,service,env",
        },
      },
  redact: {
    // Aggressive redaction — anything that looks like a credential gets
    // dropped before it reaches the log sink. Add more paths here when
    // a new secret-bearing field is introduced anywhere in the app.
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "idToken",
      "*.idToken",
      "secret",
      "*.secret",
      "clientSecret",
      "*.clientSecret",
      "apiKey",
      "*.apiKey",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "res.headers['set-cookie']",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Augment Express's Request type so `req.id`, `req.correlationId`, and
 * `req.log` are properly typed everywhere.
 */
declare module "http" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IncomingMessage {
    id?: string;
    correlationId?: string;
    log?: Logger;
  }
}

/**
 * Attach a stable request ID, propagate any inbound `X-Correlation-Id`
 * (so the trace survives across services), and bind both to a per-
 * request child logger. The IDs are echoed back as response headers so
 * end-users can quote them in bug reports.
 */
export function requestIdMiddleware(): RequestHandler {
  return function attachRequestId(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const inboundRequestId = req.header("x-request-id");
    const requestId =
      typeof inboundRequestId === "string" && inboundRequestId.length > 0
        ? inboundRequestId
        : crypto.randomUUID();

    const inboundCorrelation = req.header("x-correlation-id");
    const correlationId =
      typeof inboundCorrelation === "string" && inboundCorrelation.length > 0
        ? inboundCorrelation
        : requestId;

    req.id = requestId;
    req.correlationId = correlationId;
    req.log = logger.child({ requestId, correlationId });

    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Correlation-Id", correlationId);
    next();
  };
}

/**
 * Express access-log middleware. Emits one structured log line per
 * completed request with status, latency, and the request ID. Errors
 * (5xx) are logged at `error`, client errors (4xx) at `warn`, normal
 * traffic at `info`.
 */
export function accessLogMiddleware(): RequestHandler {
  return function logAccess(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const userId =
        (req as Request & { user?: { id?: number } }).user?.id ?? null;
      const log = req.log ?? logger;
      const payload = {
        userId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip,
        userAgent: req.header("user-agent"),
      };
      if (res.statusCode >= 500) {
        log.error(payload, "request_failed_server_error");
      } else if (res.statusCode >= 400) {
        log.warn(payload, "request_failed_client_error");
      } else {
        log.info(payload, "request_ok");
      }
    });
    next();
  };
}

/**
 * Structured business event helper. Use sparingly — a business event
 * is a meaningful product action (signup, scan_started, billing_upgrade)
 * that downstream analytics may want to consume. Free-form info logs
 * should NOT use this.
 */
export function logBusinessEvent(
  event: string,
  userId: number | null,
  metadata?: Record<string, unknown>
): void {
  logger.info(
    {
      event,
      userId,
      ...metadata,
    },
    `business_event:${event}`
  );
}
