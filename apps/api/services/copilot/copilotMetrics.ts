/**
 * GitHub Copilot Enterprise metrics.
 * Replaces the existing mocked data with real GitHub Copilot API integration.
 * Fetches seat assignments, usage statistics, and cost data.
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { copilotSyncState } from "@rakshex/database/schema-enterprise";
import { eq, and, desc } from "drizzle-orm";

interface CopilotSeat {
  assignee: { login: string; name?: string; id: number };
  assigned_at: string;
  last_activity_at?: string;
  last_activity_editor?: string;
  plan_type: string;
}

interface CopilotUsageMetrics {
  total_active_users: number;
  total_engaged_users: number;
  total_suggestions: number;
  total_acceptances: number;
  total_lines_suggested: number;
  total_lines_accepted: number;
  total_chat_acceptances: number;
  total_chat_turns: number;
  users: Array<{
    login: string;
    suggestions: number;
    acceptances: number;
    lines_suggested: number;
    lines_accepted: number;
  }>;
}

/**
 * Fetch Copilot seat assignments from GitHub API.
 */
export async function fetchCopilotSeats(orgName: string, token: string): Promise<CopilotSeat[]> {
  try {
    const allSeats: CopilotSeat[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/orgs/${orgName}/copilot/billing/seats?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } },
      );

      if (!response.ok) {
        logger.error({ status: response.status, orgName }, "[Copilot] Failed to fetch seats");
        return allSeats;
      }

      const data = (await response.json()) as { seats: CopilotSeat[] };
      allSeats.push(...data.seats);
      hasMore = data.seats.length === 100;
      page++;
    }

    logger.info({ orgName, seatCount: allSeats.length }, "[Copilot] Seats fetched");
    return allSeats;
  } catch (err: unknown) {
    logger.error({ err, orgName }, "[Copilot] Seat fetch failed");
    return [];
  }
}

/**
 * Fetch Copilot usage metrics for a time period.
 */
export async function fetchCopilotUsage(
  orgName: string,
  token: string,
  since?: string,
): Promise<CopilotUsageMetrics> {
  try {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    params.set("page", "1");
    params.set("per_page", "100");

    const response = await fetch(
      `https://api.github.com/orgs/${orgName}/copilot/metrics?${params}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } },
    );

    if (!response.ok) {
      logger.error({ status: response.status, orgName }, "[Copilot] Failed to fetch metrics");
      return {
        total_active_users: 0,
        total_engaged_users: 0,
        total_suggestions: 0,
        total_acceptances: 0,
        total_lines_suggested: 0,
        total_lines_accepted: 0,
        total_chat_acceptances: 0,
        total_chat_turns: 0,
        users: [],
      };
    }

    const data = (await response.json()) as CopilotUsageMetrics[];
    // GitHub returns an array of daily metrics; aggregate them
    const aggregated: CopilotUsageMetrics = {
      total_active_users: 0,
      total_engaged_users: 0,
      total_suggestions: 0,
      total_acceptances: 0,
      total_lines_suggested: 0,
      total_lines_accepted: 0,
      total_chat_acceptances: 0,
      total_chat_turns: 0,
      users: [],
    };

    for (const day of data) {
      aggregated.total_active_users = Math.max(
        aggregated.total_active_users,
        day.total_active_users,
      );
      aggregated.total_engaged_users = Math.max(
        aggregated.total_engaged_users,
        day.total_engaged_users,
      );
      aggregated.total_suggestions += day.total_suggestions;
      aggregated.total_acceptances += day.total_acceptances;
      aggregated.total_lines_suggested += day.total_lines_suggested;
      aggregated.total_lines_accepted += day.total_lines_accepted;
      aggregated.total_chat_acceptances += day.total_chat_acceptances;
      aggregated.total_chat_turns += day.total_chat_turns;
      aggregated.users.push(...day.users);
    }

    return aggregated;
  } catch (err: unknown) {
    logger.error({ err, orgName }, "[Copilot] Usage fetch failed");
    return {
      total_active_users: 0,
      total_engaged_users: 0,
      total_suggestions: 0,
      total_acceptances: 0,
      total_lines_suggested: 0,
      total_lines_accepted: 0,
      total_chat_acceptances: 0,
      total_chat_turns: 0,
      users: [],
    };
  }
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

  // Calculate estimated cost: $19/user/month for Copilot Business
  const estimatedCostUsd = (usage.total_engaged_users * 19).toFixed(2);

  await dbConn.insert(copilotSyncState).values({
    workspaceId,
    orgName,
    totalSeats: seats.length,
    activeSeats: usage.total_active_users,
    totalUsageUsd: estimatedCostUsd,
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
    { workspaceId, orgName, seats: seats.length, activeUsers: usage.total_active_users },
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
