/**
 * Slack alert delivery (Block Kit).
 *
 * Two modes, both functional without a Slack app:
 *
 * - **bot** — `SLACK_BOT_TOKEN` + a `channelId` are configured: posts via
 *   `chat.postMessage` to any channel. Needs only a bot token, not a full
 *   app with interactivity enabled.
 * - **webhook** (fallback) — posts to an incoming-webhook URL (per-rule
 *   `channels.slack.webhookUrl`, else `SLACK_WEBHOOK_URL`).
 *
 * Approve / Reject are URL buttons pointing at signed, expiring callback
 * URLs (see `approvalCallbacks.ts`). True in-channel interactive payloads
 * (Slack POSTing the click back to us) would need Slack app credentials —
 * tracked as BLOCKED-ON-BOSS; the URL-button form works everywhere today.
 */

import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { AlertSeverity } from "./alertRules";
import { labelSuffix, type SignalLabel } from "./alertSignals";

const SLACK_TIMEOUT_MS = 5_000;
const SLACK_CHAT_API = "https://slack.com/api/chat.postMessage";

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  low: "ℹ️",
  medium: "⚠️",
  high: "🟠",
  critical: "🚨",
};

export interface SlackApprovalActions {
  /** Signed, expiring — null when the signing secret is unavailable. */
  approveUrl: string | null;
  rejectUrl: string | null;
}

export interface SlackAlert {
  title: string;
  summary: string;
  severity: AlertSeverity;
  fields?: Array<{ name: string; value: string }>;
  /** Dashboard deep-link shown under the summary. */
  url?: string;
  signalLabel?: SignalLabel;
  approval?: SlackApprovalActions;
}

export interface SlackChannelConfig {
  /** Incoming-webhook URL for fallback mode (else SLACK_WEBHOOK_URL env). */
  webhookUrl?: string;
  /** Channel ID for bot mode (requires SLACK_BOT_TOKEN). */
  channelId?: string;
}

export interface SlackSendResult {
  ok: boolean;
  status: number;
  mode: "bot" | "webhook" | "unconfigured";
  errorMessage?: string;
}

/**
 * Build the Block Kit blocks without sending. Exposed for tests.
 * Approve / Reject render as URL buttons only when signed URLs exist —
 * never as dead buttons.
 */
export function buildSlackBlocks(alert: SlackAlert): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${SEVERITY_EMOJI[alert.severity]} ${truncate(alert.title, 150)}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: truncate(alert.summary, 2800) },
    },
  ];

  const fieldBlocks = (alert.fields ?? []).slice(0, 10).map((f) => ({
    type: "mrkdwn" as const,
    text: `*${escapeMrkdwn(f.name)}*\n${escapeMrkdwn(truncate(f.value, 900))}`,
  }));
  if (fieldBlocks.length > 0) {
    blocks.push({ type: "section", fields: fieldBlocks });
  }

  const context: string[] = [];
  if (alert.signalLabel) context.push(`_signal: ${alert.signalLabel}${labelSuffix(alert.signalLabel)}_`);
  if (alert.url) context.push(`<${alert.url}|Open in RaksHex>`);
  if (context.length > 0) {
    blocks.push({
      type: "context",
      elements: context.map((t) => ({ type: "mrkdwn", text: t })),
    });
  }

  const actions: Array<Record<string, unknown>> = [];
  if (alert.approval?.approveUrl) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "✅ Approve", emoji: true },
      style: "primary",
      url: alert.approval.approveUrl,
      action_id: "approve",
    });
  }
  if (alert.approval?.rejectUrl) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "⛔ Reject", emoji: true },
      style: "danger",
      url: alert.approval.rejectUrl,
      action_id: "reject",
    });
  }
  if (actions.length > 0) blocks.push({ type: "actions", elements: actions });

  return blocks;
}

/** POST the alert. Never throws — returns a result on all paths. */
export async function sendSlackAlert(
  channel: SlackChannelConfig,
  alert: SlackAlert,
): Promise<SlackSendResult> {
  const blocks = buildSlackBlocks(alert);
  const text = `${SEVERITY_EMOJI[alert.severity]} ${alert.title} — ${alert.summary}`.slice(0, 500);
  const body = JSON.stringify({ text, blocks });

  // Bot mode: SLACK_BOT_TOKEN + channelId → chat.postMessage.
  const botToken = ENV.slackBotToken;
  if (botToken && channel.channelId) {
    try {
      const res = await fetchWithTimeout(SLACK_CHAT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({ channel: channel.channelId, text, blocks }),
        timeoutMs: SLACK_TIMEOUT_MS,
      });
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          mode: "bot",
          errorMessage: (await safeBody(res)).slice(0, 256),
        };
      }
      return { ok: true, status: res.status, mode: "bot" };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        mode: "bot",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Webhook fallback mode.
  const webhookUrl = channel.webhookUrl ?? ENV.slackWebhookUrl;
  if (!webhookUrl) {
    logger.info("[Slack] no bot token/channel or webhook URL configured — alert skipped");
    return { ok: false, status: 0, mode: "unconfigured", errorMessage: "no Slack destination configured" };
  }
  if (!isHttpsUrl(webhookUrl)) {
    return { ok: false, status: 0, mode: "webhook", errorMessage: "webhook URL must be https" };
  }
  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      timeoutMs: SLACK_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        mode: "webhook",
        errorMessage: (await safeBody(res)).slice(0, 256),
      };
    }
    return { ok: true, status: res.status, mode: "webhook" };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      mode: "webhook",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function isHttpsUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

async function safeBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
