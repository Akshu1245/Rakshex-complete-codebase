/**
 * GitHub Copilot Enterprise metrics.
 * Replaces the existing mocked data with real GitHub Copilot API integration.
 * Fetches seat assignments, usage statistics, and cost data.
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { copilotSyncState } from "@rakshex/database/schema-enterprise";
import { eq, and, desc } from "drizzle-orm";

export interface CopilotSeat {
  assignee: { login: string; name?: string; id: number };
  assigned_at: string;
  last_activity_at?: string;
  last_activity_editor?: string;
  plan_type: string;
}

export interface CopilotUserUsage {
  user_id?: string | number;
  user_login?: string;
  day?: string;
  report_start_day?: string;
  report_end_day?: string;
  ai_credits_used?: number;
  used_chat?: boolean;
  used_code_completions?: boolean;
  used_agent?: boolean;
  used_code_review?: boolean;
  used_cli?: boolean;
  ai_adoption_phase?: string;
  [key: string]: unknown;
}

export interface CopilotUsageReport {
  reportStartDay?: string;
  reportEndDay?: string;
  users: CopilotUserUsage[];
}

const GITHUB_API_VERSION = "2022-11-28";

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function githubFetch(url: string, token: string, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: githubHeaders(token), signal });
    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const waitMs = retryAfter > 0 ? Math.min(retryAfter * 1_000, 10_000) : 250 * 2 ** attempt;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, waitMs);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("GitHub Copilot sync aborted"));
          },
          { once: true },
        );
      });
      continue;
    }
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub Copilot API ${response.status}: ${body.slice(0, 300)}`);
  }
  throw new Error("GitHub Copilot API retry limit exceeded");
}

/**
 * Fetch Copilot seat assignments from GitHub API.
 */
export async function fetchCopilotSeats(
  orgName: string,
  token: string,
  signal?: AbortSignal,
): Promise<CopilotSeat[]> {
  const allSeats: CopilotSeat[] = [];
  let page = 1;
  while (page <= 100) {
    const response = await githubFetch(
      `https://api.github.com/orgs/${encodeURIComponent(orgName)}/copilot/billing/seats?per_page=100&page=${page}`,
      token,
      signal,
    );
    const data = (await response.json()) as { seats?: CopilotSeat[] };
    const seats = data.seats ?? [];
    allSeats.push(...seats);
    if (seats.length < 100) break;
    page += 1;
  }
  logger.info({ orgName, seatCount: allSeats.length }, "[Copilot] Seats fetched");
  return allSeats;
}

/**
 * Fetch the latest official 28-day per-user report. GitHub returns signed
 * download URLs whose contents are NDJSON; metrics are not returned inline.
 */
export async function fetchCopilotUsage(
  orgName: string,
  token: string,
  _since?: string,
  signal?: AbortSignal,
): Promise<CopilotUsageReport> {
  const response = await githubFetch(
    `https://api.github.com/orgs/${encodeURIComponent(orgName)}/copilot/metrics/reports/users-28-day/latest`,
    token,
    signal,
  );
  const report = (await response.json()) as {
    download_links?: string[];
    report_start_day?: string;
    report_end_day?: string;
  };
  const users: CopilotUserUsage[] = [];
  for (const link of report.download_links ?? []) {
    const parsed = new URL(link);
    if (parsed.protocol !== "https:") {
      throw new Error("GitHub Copilot report download URL must use HTTPS");
    }
    const download = await fetch(link, { signal });
    if (!download.ok) {
      throw new Error(`GitHub Copilot report download failed (${download.status})`);
    }
    const ndjson = await download.text();
    for (const line of ndjson.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as CopilotUserUsage;
        if (row && typeof row === "object") users.push(row);
      } catch {
        throw new Error("GitHub Copilot report contained invalid NDJSON");
      }
    }
  }
  return {
    reportStartDay: report.report_start_day,
    reportEndDay: report.report_end_day,
    users,
  };
}

/**
 * Sync Copilot metrics for a workspace's GitHub org.
 */
export async function syncCopilotMetrics(
  workspaceId: number,
  orgName: string,
  token: string,
): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) return;

  const seats = await fetchCopilotSeats(orgName, token);
  const usage = await fetchCopilotUsage(
    orgName,
    token,
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  );

  const activeUsers = new Set(
    usage.users
      .filter(
        (user) =>
          Boolean(user.used_chat) ||
          Boolean(user.used_code_completions) ||
          Boolean(user.used_agent) ||
          Boolean(user.used_code_review) ||
          Boolean(user.used_cli) ||
          Number(user.ai_credits_used ?? 0) > 0,
      )
      .map((user) => String(user.user_id ?? user.user_login ?? "")),
  );

  await dbConn.insert(copilotSyncState).values({
    workspaceId,
    orgName,
    totalSeats: seats.length,
    activeSeats: activeUsers.size,
    // Copilot reports credits/activity, not a reliable invoiced USD amount.
    totalUsageUsd: "0.00",
    data: {
      seats,
      usage,
      syncedAt: new Date().toISOString(),
      seatDetails: seats.map((s) => ({
        login: s.assignee.login,
        name: s.assignee.name,
        lastActivity: s.last_activity_at,
        planType: s.plan_type,
      })),
      perUserMetrics: usage.users,
    },
    syncedAt: new Date(),
  });

  logger.info(
    { workspaceId, orgName, seats: seats.length, activeUsers: activeUsers.size },
    "[Copilot] Metrics synced",
  );
}

/**
 * Get the latest synced Copilot metrics for a workspace.
 */
export async function getCopilotMetrics(workspaceId: number): Promise<{
  orgName: string;
  totalSeats: number;
  activeSeats: number;
  totalUsageUsd: string;
  lastSynced: Date;
  seatDetails: Array<{ login: string; name?: string; lastActivity?: string; planType: string }>;
} | null> {
  const dbConn = await db.getDb();
  if (!dbConn) return null;

  const latest = (
    await dbConn
      .select()
      .from(copilotSyncState)
      .where(eq(copilotSyncState.workspaceId, workspaceId))
      .orderBy(desc(copilotSyncState.syncedAt))
      .limit(1)
  )[0];

  if (!latest) return null;

  const d = latest.data as
    | {
        seatDetails?: Array<{
          login: string;
          name?: string;
          lastActivity?: string;
          planType: string;
        }>;
      }
    | undefined;
  return {
    orgName: latest.orgName,
    totalSeats: latest.totalSeats,
    activeSeats: latest.activeSeats,
    totalUsageUsd: latest.totalUsageUsd,
    lastSynced: latest.syncedAt,
    seatDetails: d?.seatDetails ?? [],
  };
}
