/**
 * PagerDuty Events API v2 integration.
 *
 * Sends `trigger`, `acknowledge`, and `resolve` events to the public
 * PagerDuty Events v2 endpoint. The integration uses an integration's
 * "routing key" (32-char hex) — never an API key — which is the credential
 * PagerDuty issues per integration in the user's PD service.
 *
 * Reference:
 *   https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event
 *
 * The dedup_key is computed from the alert rule id + severity by default
 * so re-fires of the same rule deduplicate into a single PD incident
 * lifecycle (trigger → ack → resolve).
 */

import crypto from "crypto";

import type { AlertSeverity } from "./alertRules";
import { logger } from "../_core/logger";

const PD_EVENTS_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";
const PD_TIMEOUT_MS = 5_000;

export type PagerDutyAction = "trigger" | "acknowledge" | "resolve";

const PD_SEVERITY: Record<AlertSeverity, "info" | "warning" | "error" | "critical"> = {
  low: "info",
  medium: "warning",
  high: "error",
  critical: "critical",
};

export interface PagerDutyEvent {
  routingKey: string;
  action: PagerDutyAction;
  /** Stable id used to dedupe on PD's side. */
  dedupKey: string;
  /** Short summary (PD truncates to 1024 chars). */
  summary: string;
  /** Logical source (host/service identifier). */
  source: string;
  severity: AlertSeverity;
  /** Optional structured detail surfaced as `custom_details` on PD. */
  customDetails?: Record<string, unknown>;
  /** Optional links displayed in the incident UI. */
  links?: Array<{ href: string; text: string }>;
}

export interface PagerDutyResult {
  ok: boolean;
  status: number;
  /** PD's own dedup_key echo, useful for follow-up acks/resolves. */
  dedupKey?: string;
  /** Body excerpt on failure, never logged for success. */
  errorMessage?: string;
}

/**
 * Build a stable dedup key for an alert rule trigger. Hashes the inputs
 * so a routing key isn't accidentally leaked into PD's UI as the key,
 * and so the key is bounded length.
 */
export function buildDedupKey(ruleId: number, severity: AlertSeverity, scope?: string): string {
  const h = crypto.createHash("sha256");
  h.update(`rule=${ruleId}`);
  h.update(`|sev=${severity}`);
  if (scope) h.update(`|scope=${scope}`);
  return h.digest("hex").slice(0, 32);
}

/** Validates a 32-char hex routing key. Returns null if valid. */
export function validateRoutingKey(key: string): string | null {
  if (!key || typeof key !== "string") return "routing key required";
  if (!/^[A-Za-z0-9]{16,64}$/.test(key)) {
    return "routing key must be alphanumeric, 16–64 chars";
  }
  return null;
}

/**
 * Build the Events v2 payload body. Exposed so tests can assert the shape
 * without sending real network calls to PagerDuty.
 */
export function buildPagerDutyBody(event: PagerDutyEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {
    routing_key: event.routingKey,
    event_action: event.action,
    dedup_key: event.dedupKey,
  };

  if (event.action === "trigger") {
    base.payload = {
      summary: event.summary.slice(0, 1024),
      source: event.source,
      severity: PD_SEVERITY[event.severity],
      ...(event.customDetails ? { custom_details: event.customDetails } : {}),
    };
    if (event.links?.length) base.links = event.links.slice(0, 10);
  }
  return base;
}

/** Fire the event. Never throws — returns a result object on all paths. */
export async function sendPagerDutyEvent(event: PagerDutyEvent): Promise<PagerDutyResult> {
  const reason = validateRoutingKey(event.routingKey);
  if (reason) {
    logger.warn({ reason }, "[PagerDuty] invalid routing key");
    return { ok: false, status: 0, errorMessage: reason };
  }

  const body = JSON.stringify(buildPagerDutyBody(event));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PD_TIMEOUT_MS);
  try {
    const res = await fetch(PD_EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });
    let parsed: { dedup_key?: string; status?: string; message?: string } = {};
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      // PD always returns JSON, but tests may stub a non-JSON response —
      // keep the network call robust.
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        errorMessage: parsed.message ?? parsed.status ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, dedupKey: parsed.dedup_key ?? event.dedupKey };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
