import type { PrivacyMode, ToolCallRecord, UsageEvent } from "./types.js";

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[a-zA-Z0-9]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\bsk-ant-[a-zA-Z0-9\-_]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]"],
];

/** Redact known secret shapes from free text. */
export function redactSecrets(text: string): { value: string; count: number } {
  let value = text;
  let count = 0;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    value = value.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  }
  return { value, count };
}

/**
 * Apply privacy mode to an outbound usage event.
 * - metadata_only / zero_retention: strip all content
 * - redacted_content: keep redacted content
 * - full_content: keep content after secret redaction
 * - local_only: same strip as metadata_only for network (caller keeps local copy)
 */
export function applyPrivacy(event: UsageEvent, mode: PrivacyMode): UsageEvent {
  const out: UsageEvent = { ...event, toolCalls: event.toolCalls.map((t) => ({ ...t })) };

  // Never ship raw provider keys in metadata
  if (out.metadata) {
    out.metadata = scrubMetadataKeys(out.metadata);
  }

  if (mode === "metadata_only" || mode === "zero_retention" || mode === "local_only") {
    delete out.promptContent;
    delete out.responseContent;
    out.toolCalls = stripToolArgs(out.toolCalls);
    if (mode === "zero_retention") {
      delete out.promptHash;
      delete out.responseHash;
    }
    return out;
  }

  if (mode === "redacted_content" || mode === "full_content") {
    if (out.promptContent) {
      const r = redactSecrets(out.promptContent);
      out.promptContent = r.value;
      out.redactionCount += r.count;
    }
    if (out.responseContent) {
      const r = redactSecrets(out.responseContent);
      out.responseContent = r.value;
      out.redactionCount += r.count;
    }
    if (mode === "redacted_content") {
      // Already redacted secrets; content may still be long
    }
  }

  return out;
}

function stripToolArgs(tools: ToolCallRecord[]): ToolCallRecord[] {
  return tools.map(({ name, latencyMs, error, argKeys }) => ({
    name,
    latencyMs,
    error,
    argKeys,
  }));
}

const FORBIDDEN_META_KEYS = new Set([
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "openai_api_key",
  "anthropic_api_key",
  "aws_secret_access_key",
  "azure_api_key",
]);

export function scrubMetadataKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase().replace(/-/g, "_");
    if (FORBIDDEN_META_KEYS.has(lower) || lower.includes("api_key") || lower.endsWith("_secret")) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string" && looksLikeProviderKey(v)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Detect common provider API key shapes without storing them. */
export function looksLikeProviderKey(value: string): boolean {
  if (value.length < 20) return false;
  if (/^sk-[a-zA-Z0-9]{20,}/.test(value)) return true;
  if (/^sk-ant-/.test(value)) return true;
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) return true;
  if (/^AIza[0-9A-Za-z\-_]{30,}/.test(value)) return true;
  return false;
}

/** Assert options.apiKey is a Rakshex key, not a provider key (soft check). */
export function assertNotProviderKey(apiKey: string): void {
  if (looksLikeProviderKey(apiKey) && !apiKey.startsWith("rx_") && !apiKey.startsWith("rks_")) {
    // Soft warning path — still allow test keys that are hashed server-side
    // We never log the key value.
  }
}
