/**
 * GitHub App Integration — Octokit wrapper, webhook handler, and PR scan worker.
 *
 * Requires: @octokit/app, @octokit/rest, @octokit/webhooks (install separately).
 */

import { logger } from "../_core/logger";
import * as db from "../db";

// ─────────────────────────────────────────────────────────────────────────
// Octokit App initialization
// ─────────────────────────────────────────────────────────────────────────

let octokitApp: unknown = null;

function getOctokitApp(): unknown {
  if (octokitApp) return octokitApp;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    logger.warn("[githubApp] GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not set");
    return null;
  }

  try {
    // @ts-expect-error — dynamic import for optional dependency
    const { App } = require("@octokit/app");
    octokitApp = new App({
      appId,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
    logger.info("[githubApp] initialized");
  } catch (err) {
    logger.error({ err }, "[githubApp] failed to initialize @octokit/app");
  }

  return octokitApp;
}

export async function getInstallationClient(installationId: number): Promise<unknown> {
  const app = getOctokitApp() as { getInstallationOctokit: (id: number) => Promise<unknown> } | null;
  if (!app) throw new Error("GitHub App not configured");
  return app.getInstallationOctokit(installationId);
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  try {
    const crypto = require("crypto") as typeof import("crypto");
    const expected = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")}`;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

export async function listReposForInstallation(installationId: number): Promise<string[]> {
  try {
    const octokit = await getInstallationClient(installationId) as {
      paginate: (method: unknown, params: unknown) => Promise<Array<{ full_name: string }>>;
      rest: { apps: { listReposAccessibleToInstallation: unknown } };
    };
    const repos = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 100 },
    );
    return repos.map((r) => r.full_name);
  } catch (err) {
    logger.error({ err, installationId }, "[githubApp] failed to list repos");
    return [];
  }
}
