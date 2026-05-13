/**
 * Discord webhook integration.
 *
 * Posts rich-embed alerts into a Discord channel via webhook URL. The
 * caller supplies a normalized `AlertDelivery`; this module shapes it into
 * Discord's embed schema. Webhook URLs are NEVER logged — only the host
 * portion appears in audit lines.
 */

import type { AlertSeverity } from "./alertRules";
import { logger } from "../_core/logger";

const DISCORD_TIMEOUT_MS = 5_000;
const MAX_FIELDS = 25;
const MAX_FIELD_VALUE_LEN = 1024;

const SEVERITY_COLOR: Record<AlertSeverity, number> = {
  low: 0x3b82f6, // blue
  medium: 0xeab308, // yellow
  high: 0xf97316, // orange
  critical: 0xdc2626, // red
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  low: "ℹ️",
  medium: "⚠️",
  high: "🟠",
  critical: "🚨",
};

export interface DiscordAlert {
  webhookUrl: string;
  /** "Ojas Security" by default; overridable for white-label deployments. */
  username?: string;
  /** Avatar override URL (must be https). */
  avatarUrl?: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  /** Optional clickable URL the embed should anchor to. */
  url?: string;
  /** Override the timestamp shown on the embed (defaults to now). */
  timestamp?: Date;
}

export interface DiscordSendResult {
  ok: boolean;
  status: number;
  /** Host portion only — useful for logs without leaking the secret token. */
  host?: string;
  errorMessage?: string;
}

/**
 * Validate a Discord webhook URL. Returns null when valid, otherwise the
 * reason. Centralized here so the alert-rule validator and the runtime
 * sender share one definition.
 */
export function validateDiscordWebhookUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "must be a valid URL";
  }
  if (parsed.protocol !== "https:") return "must be https";
  if (
    parsed.hostname !== "discord.com" &&
    parsed.hostname !== "discordapp.com"
  ) {
    return "must be a discord.com webhook";
  }
  if (!parsed.pathname.startsWith("/api/webhooks/")) {
    return "must point to /api/webhooks/...";
  }
  return null;
}

/**
 * Build the Discord webhook body without sending. Exposed so tests can
 * verify the embed shape without a real network call.
 */
export function buildDiscordBody(alert: DiscordAlert): Record<string, unknown> {
  const safeFields = (alert.fields ?? [])
    .slice(0, MAX_FIELDS)
    .map(f => ({
      name: truncate(f.name, 256),
      value: truncate(f.value, MAX_FIELD_VALUE_LEN),
      inline: !!f.inline,
    }));

  const embed: Record<string, unknown> = {
    title: `${SEVERITY_EMOJI[alert.severity]} ${truncate(alert.title, 256)}`,
    description: truncate(alert.description, 4000),
    color: SEVERITY_COLOR[alert.severity],
    timestamp: (alert.timestamp ?? new Date()).toISOString(),
    footer: { text: "Ojas Security" },
  };
  if (alert.url) embed.url = alert.url;
  if (safeFields.length > 0) embed.fields = safeFields;

  const body: Record<string, unknown> = {
    username: alert.username ?? "Ojas Security",
    embeds: [embed],
  };
  if (alert.avatarUrl) body.avatar_url = alert.avatarUrl;
  return body;
}

/**
 * POST the alert to Discord. Returns the result; never throws on network /
 * 4xx errors so the caller can record the failure without aborting the
 * outer evaluation loop.
 *
 * NOTE: the webhook URL is intentionally redacted in logs — only the host.
 */
export async function sendDiscordAlert(
  alert: DiscordAlert
): Promise<DiscordSendResult> {
  const reason = validateDiscordWebhookUrl(alert.webhookUrl);
  if (reason) {
    logger.warn({ reason }, "[Discord] invalid webhook url");
    return { ok: false, status: 0, errorMessage: reason };
  }
  const body = JSON.stringify(buildDiscordBody(alert));
  const host = new URL(alert.webhookUrl).hostname;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DISCORD_TIMEOUT_MS);
  try {
    const res = await fetch(alert.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let msg = "";
      try {
        msg = (await res.text()).slice(0, 256);
      } catch {
        // Body may not be readable, ignore
      }
      return { ok: false, status: res.status, host, errorMessage: msg };
    }
    return { ok: true, status: res.status, host };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      host,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
