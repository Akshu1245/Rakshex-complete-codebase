/**
 * GitHub App Integration — fully functional for production.
 * Uses @octokit/app when credentials present.
 * Dev/test may use in-memory linking + mock Octokit when credentials are absent.
 * Production never returns mock clients or fake repos.
 */

import { logger } from "../_core/logger";
import * as db from "../db";

/** Live GitHub App install URL from slug (preferred) or numeric App ID. */
export function resolveGithubAppInstallUrl(slug = "", appId = ""): string | null {
  const s = (slug || "").trim();
  if (s) {
    return `https://github.com/apps/${encodeURIComponent(s)}/installations/new`;
  }
  const id = (appId || "").trim();
  if (id && /^\d+$/.test(id)) {
    return `https://github.com/apps/${id}/installations/new`;
  }
  return null;
}

const isProduction = process.env.NODE_ENV === "production";

// In-memory store for installations (dev cache; production also persists via DB)
const installations = new Map<
  number,
  {
    installationId: number;
    workspaceId: string;
    accountLogin: string;
    accountType: string;
    linkedAt: string;
    repos?: Array<{ fullName: string; private?: boolean; defaultBranch?: string }>;
  }
>();

let octokitApp: any = null;

function requireGithubAppCredentials(): { appId: string; privateKey: string } {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error("GitHub App is not configured — set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY");
  }
  return { appId, privateKey };
}

function getOctokitApp(): any {
  if (octokitApp) return octokitApp;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    if (isProduction) {
      throw new Error(
        "GitHub App credentials are required in production — set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY",
      );
    }
    logger.warn(
      "[githubApp] No GitHub App credentials — running in mock/dev mode with in-memory linking",
    );
    return null;
  }

  try {
    const { App } = require("@octokit/app");
    octokitApp = new App({
      appId,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
    logger.info("[githubApp] Real GitHub App initialized");
  } catch (err) {
    if (isProduction) {
      throw new Error(
        `Failed to initialize GitHub App: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    logger.error({ err }, "[githubApp] Failed to load @octokit/app — falling back to mock");
  }
  return octokitApp;
}

export async function getInstallationClient(installationId: number): Promise<any> {
  const app = getOctokitApp();
  if (!app) {
    if (isProduction) {
      throw new Error("GitHub App is not configured for this environment");
    }
    // Dev fallback: limited mock client
    logger.info({ installationId }, "[githubApp] Using dev mock Octokit client");
    return {
      rest: {
        pulls: {
          listFiles: async () => ({ data: [] }),
        },
        repos: {
          getContent: async () => ({ data: { content: "", encoding: "utf8" } }),
        },
        issues: {
          createComment: async (params: any) => {
            logger.info({ ...params }, "[githubApp][mock] Would post PR comment");
          },
        },
      },
    };
  }
  return app.getInstallationOctokit(installationId);
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("[githubApp] GITHUB_WEBHOOK_SECRET missing — rejecting webhook");
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    const crypto = require("crypto") as typeof import("crypto");
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Link installation — persists to github_installations via Drizzle.
 */
export async function linkInstallation(
  installationId: number,
  workspaceId: number,
  accountLogin: string,
  accountType: "Organization" | "User",
  permissions: Record<string, unknown> = {},
): Promise<void> {
  if (isProduction) {
    requireGithubAppCredentials();
    getOctokitApp();
  }

  installations.set(installationId, {
    installationId,
    workspaceId: String(workspaceId),
    accountLogin,
    accountType,
    linkedAt: new Date().toISOString(),
    repos: [],
  });
  await db.upsertGithubInstallation({
    installationId,
    workspaceId,
    accountLogin,
    accountType,
    permissions,
  });

  logger.info({ installationId, workspaceId, accountLogin }, "[githubApp] installation linked");
}

/**
 * List repos for an installation.
 * Returns objects with fullName etc (matches frontend expectations).
 */
export async function listReposForInstallation(
  installationId: number,
): Promise<Array<{ fullName: string; private?: boolean; defaultBranch?: string }>> {
  const stored = installations.get(installationId);
  if (stored?.repos && stored.repos.length > 0) {
    return stored.repos;
  }

  const app = getOctokitApp();
  if (!app) {
    if (isProduction) {
      throw new Error("GitHub App is not configured for this environment");
    }
    // Dev-friendly mock data so the UI works immediately
    logger.info({ installationId }, "[githubApp] Returning mock repos for dev");
    return [
      { fullName: "your-org/api-service", private: true, defaultBranch: "main" },
      { fullName: "your-org/frontend", private: true, defaultBranch: "main" },
      { fullName: "your-org/payments", private: false, defaultBranch: "master" },
    ];
  }

  try {
    const octokit = await app.getInstallationOctokit(installationId);
    const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });

    const result = repos.map((r: any) => ({
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    }));

    // Cache for future calls
    if (stored) stored.repos = result;
    else
      installations.set(installationId, {
        installationId,
        workspaceId: "unknown",
        accountLogin: "unknown",
        accountType: "User",
        linkedAt: new Date().toISOString(),
        repos: result,
      });

    return result;
  } catch (err) {
    logger.error({ err, installationId }, "[githubApp] failed to list repos from GitHub");
    if (isProduction) {
      throw new Error(`Failed to list repositories for GitHub installation ${installationId}`);
    }
    return stored?.repos || [];
  }
}

export async function getLinkedInstallation(installationId: number) {
  const cached = installations.get(installationId);
  if (cached) return cached;
  const stored = await db.getGithubInstallation(installationId);
  if (!stored) return undefined;
  const linked = {
    installationId: stored.installationId,
    workspaceId: String(stored.workspaceId),
    accountLogin: stored.accountLogin,
    accountType: stored.accountType,
    linkedAt: stored.linkedAt.toISOString(),
  };
  installations.set(installationId, linked);
  return linked;
}
