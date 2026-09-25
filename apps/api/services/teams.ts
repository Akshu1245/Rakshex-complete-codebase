/**
 * Teams alert delivery (Office 365 connector MessageCard).
 *
 * Single mode: incoming-webhook URL — per-rule `channels.teams.webhookUrl`,
 * else `TEAMS_WEBHOOK_URL`. A Teams bot/app with interactive Adaptive Card
 * callbacks would need Teams app credentials (BLOCKED-ON-BOSS), so
 * Approve / Reject are `OpenUri` actions pointing at the same signed,
 * expiring callback URLs as Slack (see `approvalCallbacks.ts`).
 */

import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { AlertSeverity } from "./alertRules";
import { labelSuffix, type SignalLabel } from "./alertSignals";

const TEAMS_TIMEOUT_MS = 5_000;

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  low: "0078D4",
  medium: "FFB900",
  high: "FF8C00",
  critical: "D13438",
};

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  low: "ℹ️",
  medium: "⚠️",
  high: "🟠",
  critical: "🚨",
};

export interface TeamsApprovalActions {
  /** Signed, expiring — null when the signing secret is unavailable. */
  approveUrl: string | null;
  rejectUrl: string | null;
}

export interface TeamsAlert {
  title: string;
  summary: string;
  severity: AlertSeverity;
  facts?: Array<{ name: string; value: string }>;
  /** Dashboard deep-link shown as an action. */
  url?: string;
  signalLabel?: SignalLabel;
  approval?: TeamsApprovalActions;
}

export interface TeamsChannelConfig {
  /** Incoming-webhook URL (else TEAMS_WEBHOOK_URL env). */
  webhookUrl?: string;
}

export interface TeamsSendResult {
  ok: boolean;
  status: number;
  mode: "webhook" | "unconfigured";
  errorMessage?: string;
}

/** Build the MessageCard body without sending. Exposed for tests. */
export function buildTeamsCard(alert: TeamsAlert): Record<string, unknown> {
  const title = `${SEVERITY_EMOJI[alert.severity]} ${truncate(alert.title, 150)}`;
  const facts = (alert.facts ?? []).slice(0, 12).map((f) => ({
    name: truncate(f.name, 128),
    value: truncate(f.value, 512),
  }));
  if (alert.signalLabel) {
    facts.push({ name: "signal", value: `${alert.signalLabel}${labelSuffix(alert.signalLabel)}` });
  }

  const card: Record<string, unknown> = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: SEVERITY_COLOR[alert.severity],
    summary: truncate(alert.summary, 500),
    sections: [
      {
        activityTitle: title,
        activitySubtitle: new Date().toUTCString(),
        text: truncate(alert.summary, 2800),
        facts,
      },
    ],
  };

  const actions: Array<Record<string, unknown>> = [];
  if (alert.approval?.approveUrl) {
    actions.push(openUriAction("✅ Approve", alert.approval.approveUrl));
  }
  if (alert.approval?.rejectUrl) {
    actions.push(openUriAction("⛔ Reject", alert.approval.rejectUrl));
  }
  if (alert.url) actions.push(openUriAction("Open in RaksHex", alert.url));
  if (actions.length > 0) card.potentialAction = actions;

  return card;
}

/** POST the card. Never throws — returns a result on all paths. */
export async function sendTeamsAlert(
  channel: TeamsChannelConfig,
  alert: TeamsAlert,
): Promise<TeamsSendResult> {
  const webhookUrl = channel.webhookUrl ?? ENV.teamsWebhookUrl;
  if (!webhookUrl) {
    logger.info("[Teams] no webhook URL configured — alert skipped");
    return { ok: false, status: 0, mode: "unconfigured", errorMessage: "no Teams webhook configured" };
  }
  if (!isHttpsUrl(webhookUrl)) {
    return { ok: false, status: 0, mode: "webhook", errorMessage: "webhook URL must be https" };
  }

  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTeamsCard(alert)),
      timeoutMs: TEAMS_TIMEOUT_MS,
    });
    if (!res.ok) {
      let msg = "";
      try {
        msg = (await res.text()).slice(0, 256);
      } catch {
        // ignore
      }
      return { ok: false, status: res.status, mode: "webhook", errorMessage: msg };
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

function openUriAction(name: string, uri: string): Record<string, unknown> {
  return {
    "@type": "OpenUri",
    name,
    targets: [{ os: "default", uri }],
  };
}

function isHttpsUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
