/**
 * Shadow-AI detector.
 *
 * Takes a batch of observed LLM-style HTTP calls (host, model, source) and
 * decides per-event whether it is "sanctioned" (i.e. matches the tenant's
 * allowlist) or "shadow" (rogue traffic that should be flagged in the
 * dashboard).
 *
 * The classifier is deliberately conservative — it never blocks traffic; it
 * only labels and persists. Enforcement happens at the gateway. This service
 * exists so customers can pipe their existing egress logs (Datadog, AWS VPC
 * flow logs, gateway access logs) into Rakshex and immediately see which
 * applications are routing around the sanctioned path.
 */

import { logger } from "../_core/logger";
import type { AiAllowlistRow, InsertShadowAiEventRow } from "../../drizzle/schema";

export interface ShadowAiInputEvent {
  source: string;
  host: string;
  model?: string;
  userId: number;
  occurredAt?: number;
  raw?: Record<string, unknown>;
}

export interface ShadowAiSummary {
  total: number;
  rogue: number;
  allowlisted: number;
  perTenant: Record<number, { total: number; rogue: number }>;
}

interface ShadowAiDb {
  listAiAllowlist(userId: number): Promise<AiAllowlistRow[]>;
  recordShadowAiEvent(row: InsertShadowAiEventRow): Promise<void>;
}

const KNOWN_LLM_HOSTS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.cohere.com",
  "api.cohere.ai",
  "api.mistral.ai",
  "api.together.xyz",
  "api.fireworks.ai",
  "api.groq.com",
  "api.perplexity.ai",
  "api.deepseek.com",
  "api.x.ai",
  "openrouter.ai",
  "bedrock-runtime",
  "azure.com",
  "huggingface.co",
];

export function classifyShadowEvent(
  event: ShadowAiInputEvent,
  allowlist: ReadonlyArray<AiAllowlistRow>,
): {
  isAllowlisted: boolean;
  severity: "info" | "low" | "medium" | "high" | "critical";
  isLLMHost: boolean;
} {
  const host = event.host.toLowerCase();
  const model = event.model?.toLowerCase();
  const allowlistedByHost = allowlist.some(
    (row) => row.kind === "host" && hostMatches(host, row.pattern),
  );
  const allowlistedByModel =
    typeof model === "string" &&
    allowlist.some(
      (row) => row.kind === "model" && model.toLowerCase().includes(row.pattern.toLowerCase()),
    );
  const isAllowlisted = allowlistedByHost || allowlistedByModel;
  const isLLMHost = KNOWN_LLM_HOSTS.some((known) => host.includes(known));
  if (isAllowlisted) return { isAllowlisted, severity: "info", isLLMHost };
  if (!isLLMHost) return { isAllowlisted, severity: "low", isLLMHost };
  // Unsanctioned LLM call → medium by default; bumped to "high" if it's a
  // production-class model. We treat o-series + claude-3-* as production.
  let severity: "medium" | "high" = "medium";
  if (model && /(o\d|gpt-4|claude-3|gemini-1|gemini-2)/i.test(model)) {
    severity = "high";
  }
  return { isAllowlisted, severity, isLLMHost };
}

function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.toLowerCase().trim();
  if (p.startsWith("*.")) return host.endsWith(p.slice(1));
  return host === p || host.endsWith(`.${p}`);
}

function parseEvent(input: unknown): ShadowAiInputEvent | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const userId = Number(rec.userId);
  const source = String(rec.source ?? "log").slice(0, 64);
  const host = typeof rec.host === "string" ? rec.host.trim() : "";
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (host.length === 0 || host.length > 192) return null;
  const event: ShadowAiInputEvent = { userId, source, host };
  if (typeof rec.model === "string") event.model = rec.model.slice(0, 96);
  if (typeof rec.occurredAt === "number") event.occurredAt = rec.occurredAt;
  if (rec.raw && typeof rec.raw === "object") {
    event.raw = rec.raw as Record<string, unknown>;
  }
  return event;
}

export async function ingestShadowAiEvents(
  db: ShadowAiDb,
  events: ReadonlyArray<unknown>,
): Promise<ShadowAiSummary> {
  const summary: ShadowAiSummary = {
    total: 0,
    rogue: 0,
    allowlisted: 0,
    perTenant: {},
  };
  // Cache allowlists per tenant for the batch — most batches are
  // single-tenant and we don't want to round-trip per event.
  const allowlistCache = new Map<number, AiAllowlistRow[]>();
  for (const raw of events) {
    const ev = parseEvent(raw);
    if (!ev) continue;
    summary.total += 1;
    let allow = allowlistCache.get(ev.userId);
    if (!allow) {
      allow = await db.listAiAllowlist(ev.userId);
      allowlistCache.set(ev.userId, allow);
    }
    const cls = classifyShadowEvent(ev, allow);
    const tenant = (summary.perTenant[ev.userId] ??= { total: 0, rogue: 0 });
    tenant.total += 1;
    if (cls.isAllowlisted) {
      summary.allowlisted += 1;
    } else if (cls.isLLMHost) {
      summary.rogue += 1;
      tenant.rogue += 1;
    }
    try {
      const row: InsertShadowAiEventRow = {
        userId: ev.userId,
        source: ev.source,
        detectedHost: ev.host,
        isAllowlisted: cls.isAllowlisted,
        severity: cls.severity,
        ...(ev.model ? { detectedModel: ev.model } : {}),
        ...(ev.raw ? { rawSignals: ev.raw } : {}),
        ...(ev.occurredAt ? { occurredAt: new Date(ev.occurredAt) } : {}),
      };
      await db.recordShadowAiEvent(row);
    } catch (err) {
      logger.warn({ err }, "[ShadowAI] persist failed");
    }
  }
  return summary;
}
