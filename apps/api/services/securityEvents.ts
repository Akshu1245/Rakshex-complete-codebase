/**
 * Security event logging service.
 *
 * Every time a security control blocks or detects something
 * (RCE command, SSRF URL, prototype pollution, rate limit hit,
 *  failed auth, etc.), record it here for audit and compliance.
 */

import crypto from "crypto";
import { logger } from "../_core/logger";

export type SecurityEventType =
  | "rce_command_blocked"
  | "ssrf_url_blocked"
  | "prototype_pollution_blocked"
  | "rate_limit_hit"
  | "auth_failure"
  | "csrf_failure"
  | "password_reset_attempt"
  | "mcp_registration_rate_limited"
  | "collection_data_size_exceeded"
  | "webhook_delivery_dead_letter";

export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  userId?: number;
  ip?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// In-memory buffer — in production this should flush to DB
const eventBuffer: SecurityEvent[] = [];
const MAX_BUFFER_SIZE = 10_000;

/**
 * Log a security event. Best-effort: never throws.
 * In production, wire this to a dedicated `security_events` table.
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  details: Record<string, unknown> = {},
  meta?: { userId?: number; ip?: string; userAgent?: string },
): void {
  const event: SecurityEvent = {
    id: crypto.randomUUID(),
    eventType,
    userId: meta?.userId,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    details,
    createdAt: new Date(),
  };

  // Log to application logs for immediate visibility
  logger.warn(
    {
      eventType,
      userId: meta?.userId,
      ip: meta?.ip,
      details,
    },
    `[Security] ${eventType}`,
  );

  // Buffer for batch persistence
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift(); // drop oldest to prevent unbounded growth
  }
}

/** Get recent security events for dashboard/admin review */
export function getRecentSecurityEvents(limit = 100): SecurityEvent[] {
  return eventBuffer.slice(-limit).reverse();
}

/** Count events by type in the last N hours (for alerting) */
export function countSecurityEvents(eventType: SecurityEventType, windowHours = 1): number {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  return eventBuffer.filter((e) => e.eventType === eventType && e.createdAt.getTime() >= cutoff)
    .length;
}

/** Drain the in-memory buffer and batch-insert into the security_events table. */
export async function flushSecurityEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;
  const drained = eventBuffer.splice(0, eventBuffer.length);
  try {
    const { insertSecurityEvents } = await import("../db");
    // Map in-memory events to the DB schema shape.
    // The DB table requires workspaceId, eventType (enum subset), severity, etc.
    // We map our internal event types to the nearest DB enum value and use a
    // system workspace sentinel so rows are always valid.
    const rows = drained.map((e) => ({
      workspaceId: String(e.userId ?? "system"),
      eventType: mapEventType(e.eventType),
      severity: mapSeverity(e.eventType),
      threatLevel: e.eventType,
      detectedPatterns: e.details,
      promptHash: e.id,
      agentId: e.ip ?? null,
    }));
    await insertSecurityEvents(rows);
  } catch (err) {
    logger.error({ err }, "[SecurityEvents] Flush to DB failed — re-buffering");
    // Re-buffer up to MAX to avoid loss on transient DB errors
    eventBuffer.unshift(...drained.slice(-MAX_BUFFER_SIZE));
  }
}

let _flusherInterval: ReturnType<typeof setInterval> | null = null;

/** Start periodic 30-second flush of security events to DB. */
export function startSecurityEventsFlusher(): void {
  if (_flusherInterval) return;
  _flusherInterval = setInterval(() => {
    flushSecurityEvents().catch((err) =>
      logger.error({ err }, "[SecurityEvents] Periodic flush error"),
    );
  }, 30_000);
  logger.info("[SecurityEvents] Periodic flusher started (30s interval)");
}

/** Stop the periodic flusher and do a final flush before shutdown. */
export async function flushSecurityEventsOnShutdown(): Promise<void> {
  if (_flusherInterval) {
    clearInterval(_flusherInterval);
    _flusherInterval = null;
  }
  await flushSecurityEvents();
  logger.info("[SecurityEvents] Final flush on shutdown complete");
}

/* ─── Internal helpers ──────────────────────────────────────────────────── */

function mapEventType(
  t: SecurityEventType,
): "prompt_injection" | "pii_leak" | "policy_violation" | "anomaly" {
  if (t === "auth_failure" || t === "csrf_failure" || t === "password_reset_attempt")
    return "policy_violation";
  if (t === "rate_limit_hit" || t === "mcp_registration_rate_limited") return "anomaly";
  return "policy_violation";
}

function mapSeverity(t: SecurityEventType): "low" | "medium" | "high" | "critical" {
  if (
    t === "rce_command_blocked" ||
    t === "ssrf_url_blocked" ||
    t === "prototype_pollution_blocked"
  )
    return "critical";
  if (t === "auth_failure" || t === "csrf_failure") return "high";
  if (t === "rate_limit_hit" || t === "mcp_registration_rate_limited") return "medium";
  return "low";
}
