/**
 * Slack Integration
 * Sends notifications to Slack via webhook for critical events like kill switch triggers.
 * Silently skips if SLACK_WEBHOOK_URL is not configured.
 */

import { ExternalServiceError } from "./_core/errors";
import { logger } from "./_core/logger";
import { fetchWithTimeout } from "./utils/fetchWithTimeout";

const SLACK_TIMEOUT_MS = 5_000;

interface KillSwitchAlertOptions {
  userId: number;
  userName: string;
  reason: string;
  currentSpend: number;
  budgetLimit: number;
}

interface ScanAlertOptions {
  userId: number;
  userName: string;
  collectionName: string;
  scanId: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  triggeredBy: "user" | "github_push" | "github_pr";
  prNumber?: number;
  branch?: string;
}

interface BudgetWarningOptions {
  userId: number;
  userName: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
}

export async function sendSlackKillSwitchAlert(
  opts: KillSwitchAlertOptions
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.info(
      {
        userId: opts.userId,
        userName: opts.userName,
        reason: opts.reason,
      },
      "[Slack] Webhook not configured. Kill switch triggered"
    );
    return;
  }

  const percentUsed =
    opts.budgetLimit > 0
      ? Math.round((opts.currentSpend / opts.budgetLimit) * 100)
      : 0;

  const payload = {
    text: "🚨 *DevPulse Kill Switch Triggered*",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 Kill Switch Triggered",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*User:*\n${opts.userName} (ID: ${opts.userId})`,
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toUTCString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Current Spend:*\n$${opts.currentSpend.toFixed(2)} / $${opts.budgetLimit.toFixed(2)} (${percentUsed}%)`,
          },
          {
            type: "mrkdwn",
            text: `*Status:*\n⛔ All LLM operations BLOCKED`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reason:*\n${opts.reason}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "To re-enable LLM operations, go to DevPulse → Kill Switch → Reset",
          },
        ],
      },
    ],
  };

  const response = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ExternalServiceError(
      `Slack webhook returned ${response.status}`,
      {
        safeMessage: "Could not deliver Slack alert.",
        context: {
          provider: "slack",
          status: response.status,
          body: await response.text(),
        },
      }
    );
  }

  logger.info({ userId: opts.userId }, "[Slack] Kill switch alert sent");
}

export async function sendSlackScanAlert(
  opts: ScanAlertOptions
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.info(
      { collectionName: opts.collectionName },
      "[Slack] Webhook not configured. Scan completed"
    );
    return;
  }

  const triggerEmoji =
    opts.triggeredBy === "github_push"
      ? "🔄"
      : opts.triggeredBy === "github_pr"
        ? "🔀"
        : "🔍";
  const triggerText =
    opts.triggeredBy === "github_push"
      ? `GitHub push to ${opts.branch || "main"}`
      : opts.triggeredBy === "github_pr"
        ? `GitHub PR #${opts.prNumber}`
        : "Manual scan";

  const severityEmoji =
    opts.criticalCount > 0 ? "🚨" : opts.highCount > 0 ? "⚠️" : "✅";
  const color =
    opts.criticalCount > 0
      ? "#FF0000"
      : opts.highCount > 0
        ? "#FFA500"
        : "#36A64F";

  const payload = {
    text: `${severityEmoji} *DevPulse Security Scan Complete*`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmoji} Security Scan Complete`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Collection:*\n${opts.collectionName}`,
          },
          {
            type: "mrkdwn",
            text: `*Triggered by:*\n${triggerEmoji} ${triggerText}`,
          },
          {
            type: "mrkdwn",
            text: `*User:*\n${opts.userName} (ID: ${opts.userId})`,
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toUTCString()}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Findings Summary:*\n${opts.criticalCount > 0 ? `🚨 ${opts.criticalCount} Critical\n` : ""}${opts.highCount > 0 ? `⚠️ ${opts.highCount} High\n` : ""}Total: ${opts.totalFindings} findings`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `View full report: ${process.env.APP_URL || "http://localhost:3000"}/scanning`,
          },
        ],
      },
    ],
  };

  const response = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ExternalServiceError(
      `Slack webhook returned ${response.status}`,
      {
        safeMessage: "Could not deliver Slack alert.",
        context: {
          provider: "slack",
          status: response.status,
          body: await response.text(),
        },
      }
    );
  }

  logger.info(
    { collectionName: opts.collectionName },
    "[Slack] Scan alert sent"
  );
}

export async function sendSlackBudgetWarning(
  opts: BudgetWarningOptions
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.info(
      {
        userId: opts.userId,
        userName: opts.userName,
        percentUsed: opts.percentUsed,
      },
      "[Slack] Webhook not configured. Budget warning"
    );
    return;
  }

  const payload = {
    text: `⚠️ *DevPulse Budget Warning*`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ Budget Warning: 80% Threshold Reached",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*User:*\n${opts.userName} (ID: ${opts.userId})`,
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toUTCString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Current Spend:*\n$${opts.currentSpend.toFixed(2)}`,
          },
          {
            type: "mrkdwn",
            text: `*Budget Limit:*\n$${opts.budgetLimit.toFixed(2)}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Percent Used: ${opts.percentUsed.toFixed(1)}%*\nThe kill switch will activate at 100% to prevent overspending.`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "To adjust budget limits, go to DevPulse → Kill Switch → Settings",
          },
        ],
      },
    ],
  };

  const response = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ExternalServiceError(
      `Slack webhook returned ${response.status}`,
      {
        safeMessage: "Could not deliver Slack alert.",
        context: {
          provider: "slack",
          status: response.status,
          body: await response.text(),
        },
      }
    );
  }

  logger.info({ userId: opts.userId }, "[Slack] Budget warning sent");
}
