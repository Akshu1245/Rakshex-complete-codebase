/**
 * GitHub Integration
 * Handles GitHub webhooks for push and pull request events
 * Triggers security scans on code changes
 */

import crypto from "crypto";
import * as db from "./db";
import { enqueueScan } from "./services/jobs";
import { logger } from "./_core/logger";
import { fetchWithTimeout } from "./utils/fetchWithTimeout";
import {
  scanPullRequestFiles,
  type PullRequestFile,
} from "./services/secretScanner";

interface GitHubWebhookPayload {
  event: "push" | "pull_request";
  repository: {
    name: string;
    full_name: string;
    owner: {
      name: string;
    };
  };
  pusher?: {
    name: string;
    email: string;
  };
  ref?: string;
  after?: string;
  before?: string;
  commits?: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
  }>;
  pull_request?: {
    number: number;
    title: string;
    state: "open" | "closed" | "merged";
    head: {
      ref: string;
      sha: string;
      repo: {
        full_name: string;
      };
    };
  };
}

export function verifyGitHubWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    logger.error(
      "[GitHub] Webhook secret not configured — rejecting request. Set GITHUB_WEBHOOK_SECRET env var."
    );
    return false; // SECURITY: Reject if no secret configured
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  const expectedBuf = Buffer.from(expectedSignature);
  const sigBuf = Buffer.from(signature);
  if (expectedBuf.length !== sigBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

export async function handleGitHubPush(payload: GitHubWebhookPayload): Promise<{
  status: string;
  repository: string;
  branch: string;
  commits: number;
  message: string;
  scansTriggered: number;
}> {
  const branch = payload.ref?.replace("refs/heads/", "") || "unknown";
  const commitCount = payload.commits?.length || 0;
  const commitSha = payload.after || "";

  logger.info(
    `[GitHub] Push to ${payload.repository.full_name}:${branch} - ${commitCount} commits`
  );

  // Find collections linked to this repository
  const collections = await db.getCollectionsByRepoUrl(
    payload.repository.full_name
  );

  if (collections.length === 0) {
    logger.info(
      `[GitHub] No collections found for repo ${payload.repository.full_name}`
    );
    return {
      status: "processed",
      repository: payload.repository.full_name,
      branch,
      commits: commitCount,
      message: `No collections linked to ${payload.repository.full_name}`,
      scansTriggered: 0,
    };
  }

  // Trigger scans for each matching collection
  let scansTriggered = 0;
  for (const collection of collections) {
    try {
      logger.info(
        `[GitHub] Triggering scan for collection ${collection.id} (${collection.name})`
      );

      await enqueueScan({
        userId: collection.userId,
        collectionId: collection.id,
        options: {
          scanType: "full",
          triggeredBy: "github_push",
          branch,
          commitSha,
        },
      });

      scansTriggered++;
    } catch (error) {
      logger.error({ err: error }, `[GitHub] Failed to enqueue scan for collection ${collection.id}`);
    }
  }

  return {
    status: "processed",
    repository: payload.repository.full_name,
    branch,
    commits: commitCount,
    message: `Triggered ${scansTriggered} scan(s) for ${collections.length} collection(s)`,
    scansTriggered,
  };
}

export async function handleGitHubPullRequest(
  payload: GitHubWebhookPayload
): Promise<{
  status: string;
  repository: string;
  prNumber: number;
  title: string;
  state: string;
  message: string;
  scansTriggered: number;
}> {
  const pr = payload.pull_request!;

  logger.info(
    `[GitHub] PR #${pr.number} in ${payload.repository.full_name}: ${pr.title} - ${pr.state}`
  );

  // Only scan on open or synchronize (new commits pushed)
  if (pr.state !== "open") {
    return {
      status: "skipped",
      repository: payload.repository.full_name,
      prNumber: pr.number,
      title: pr.title,
      state: pr.state,
      message: `PR #${pr.number} is ${pr.state}, no scan needed`,
      scansTriggered: 0,
    };
  }

  // Find collections linked to this repository
  const collections = await db.getCollectionsByRepoUrl(
    payload.repository.full_name
  );

  if (collections.length === 0) {
    logger.info(
      `[GitHub] No collections found for repo ${payload.repository.full_name}`
    );
    return {
      status: "processed",
      repository: payload.repository.full_name,
      prNumber: pr.number,
      title: pr.title,
      state: pr.state,
      message: `No collections linked to ${payload.repository.full_name}`,
      scansTriggered: 0,
    };
  }

  // Trigger scans for each matching collection
  let scansTriggered = 0;
  for (const collection of collections) {
    try {
      logger.info(
        `[GitHub] Triggering PR scan for collection ${collection.id} (${collection.name})`
      );

      await enqueueScan({
        userId: collection.userId,
        collectionId: collection.id,
        options: {
          scanType: "quick", // Quick scan for PRs
          triggeredBy: "github_pr",
          prNumber: pr.number,
          branch: pr.head.ref,
          commitSha: pr.head.sha,
        },
      });

      scansTriggered++;
    } catch (error) {
      logger.error({ err: error }, `[GitHub] Failed to enqueue PR scan for collection ${collection.id}`);
    }
  }

  return {
    status: "processed",
    repository: payload.repository.full_name,
    prNumber: pr.number,
    title: pr.title,
    state: pr.state,
    message: `Triggered ${scansTriggered} PR scan(s) for ${collections.length} collection(s)`,
    scansTriggered,
  };
}

/**
 * Secret-scan a set of files from a GitHub PR (already fetched via the
 * GitHub API by the caller). Returns the findings; the caller is responsible
 * for posting a check-run / commit-status back to GitHub if desired.
 */
export interface PullRequestSecretScanInput {
  repoFullName: string;
  prNumber: number;
  commitSha: string;
  files: PullRequestFile[];
}

export interface PullRequestSecretScanOutput {
  repository: string;
  prNumber: number;
  filesScanned: number;
  findings: Array<{
    file: string;
    ruleId: string;
    description: string;
    severity: "high" | "critical";
    line: number;
    matchPreview: string;
  }>;
  shouldBlockMerge: boolean;
}

export async function secretScanPullRequest(
  input: PullRequestSecretScanInput
): Promise<PullRequestSecretScanOutput> {
  const result = scanPullRequestFiles(input.files);
  const out: PullRequestSecretScanOutput = {
    repository: input.repoFullName,
    prNumber: input.prNumber,
    filesScanned: result.filesScanned,
    findings: result.findings.map(f => ({
      file: f.file,
      ruleId: f.ruleId,
      description: f.description,
      severity: f.severity,
      line: f.line,
      matchPreview: f.matchPreview,
    })),
    shouldBlockMerge: result.findings.some(f => f.severity === "critical"),
  };
  if (result.totalFindings > 0) {
    logger.warn(
      {
        repo: input.repoFullName,
        prNumber: input.prNumber,
        commitSha: input.commitSha,
        findings: result.totalFindings,
        critical: result.findings.filter(f => f.severity === "critical").length,
      },
      "[GitHub] secret-scan findings on PR"
    );
  }
  return out;
}

/* ─── GitHub App API helpers ───────────────────────────────────────────── */

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

function getGitHubAppToken(config: GitHubAppConfig): string {
  // In production: generate a JWT from appId + privateKey, exchange for
  // installation access token. Here we accept a pre-generated token stored
  // as the privateKey field for self-hosted / dev convenience.
  return config.privateKey;
}

interface CreatePROptions {
  repoFullName: string;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
}

export async function createPullRequest(
  config: GitHubAppConfig,
  options: CreatePROptions
): Promise<{ prNumber: number; prUrl: string }> {
  const token = getGitHubAppToken(config);
  const url = `https://api.github.com/repos/${options.repoFullName}/pulls`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: options.title,
      body: options.body,
      head: options.headBranch,
      base: options.baseBranch,
    }),
  });

  if (!res || typeof (res as Response).json !== "function") {
    throw new Error("Non-HTTP transport for GitHub API");
  }
  const response = res as Response;
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      `GitHub API ${response.status}: ${body.message ?? "unknown error"}`
    );
  }

  const prNumber = body.number as number;
  const prUrl = body.html_url as string;
  logger.info({ repo: options.repoFullName, prNumber }, "[GitHub] PR created");
  return { prNumber, prUrl };
}

interface PostStatusOptions {
  repoFullName: string;
  commitSha: string;
  state: "pending" | "success" | "failure" | "error";
  context: string;
  description: string;
  targetUrl?: string;
}

export async function postCommitStatus(
  config: GitHubAppConfig,
  options: PostStatusOptions
): Promise<void> {
  const token = getGitHubAppToken(config);
  const url = `https://api.github.com/repos/${options.repoFullName}/statuses/${options.commitSha}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      state: options.state,
      context: options.context,
      description: options.description.slice(0, 140),
      target_url: options.targetUrl ?? null,
    }),
  });

  if (!res || typeof (res as Response).json !== "function") {
    throw new Error("Non-HTTP transport for GitHub API");
  }
  const response = res as Response;
  if (!response.ok) {
    const body = (await response.json()) as Record<string, unknown>;
    throw new Error(
      `GitHub status API ${response.status}: ${body.message ?? "unknown error"}`
    );
  }

  logger.info(
    { repo: options.repoFullName, sha: options.commitSha, state: options.state },
    "[GitHub] Commit status posted"
  );
}

interface PostPRReviewOptions {
  repoFullName: string;
  prNumber: number;
  body: string;
  event?: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
}

export async function postPRReview(
  config: GitHubAppConfig,
  options: PostPRReviewOptions
): Promise<void> {
  const token = getGitHubAppToken(config);
  const url = `https://api.github.com/repos/${options.repoFullName}/pulls/${options.prNumber}/reviews`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      body: options.body,
      event: options.event ?? "COMMENT",
    }),
  });

  if (!res || typeof (res as Response).json !== "function") {
    throw new Error("Non-HTTP transport for GitHub API");
  }
  const response = res as Response;
  if (!response.ok) {
    const body = (await response.json()) as Record<string, unknown>;
    throw new Error(
      `GitHub review API ${response.status}: ${body.message ?? "unknown error"}`
    );
  }

  logger.info(
    { repo: options.repoFullName, prNumber: options.prNumber },
    "[GitHub] PR review posted"
  );
}
