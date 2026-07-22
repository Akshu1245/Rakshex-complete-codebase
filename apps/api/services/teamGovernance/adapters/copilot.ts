import type { AdapterSyncContext, AdapterSyncResult, TeamGovernanceAdapter } from "../types";
import { getGovernanceCapabilities } from "../capabilities";
import { fetchCopilotSeats, fetchCopilotUsage } from "../../copilot/copilotMetrics";

const FETCH_TIMEOUT_MS = 20_000;

export function createCopilotAdapter(): TeamGovernanceAdapter {
  return {
    provider: "github_copilot",
    capabilities: getGovernanceCapabilities("github_copilot"),
    async sync(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
      const started = Date.now();
      if (!ctx.adminCredential || !ctx.orgName) {
        return {
          status: "not_configured",
          errorCode: "NOT_CONFIGURED",
          errorMessage:
            "GitHub Copilot sync requires an org admin token and organization name. Personal Copilot accounts are unsupported.",
          latencyMs: Date.now() - started,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const [seats, usage] = await Promise.all([
          fetchCopilotSeats(ctx.orgName, ctx.adminCredential, controller.signal),
          fetchCopilotUsage(
            ctx.orgName,
            ctx.adminCredential,
            ctx.since?.toISOString(),
            controller.signal,
          ),
        ]);

        const normalizedSeats = seats.map((s) => ({
          // Per-user usage reports expose user_login, so login is the stable
          // cross-endpoint identity key. Numeric GitHub ID is retained as metadata.
          externalUserId: s.assignee.login,
          email: undefined,
          displayName: s.assignee.name ?? s.assignee.login,
          status: "active" as const,
          lastActivityAt: s.last_activity_at ? new Date(s.last_activity_at) : undefined,
          metadata: {
            githubUserId: s.assignee.id,
            login: s.assignee.login,
            planType: s.plan_type,
            assignedAt: s.assigned_at,
            lastActivityEditor: s.last_activity_editor,
          },
        }));

        const reportKey =
          usage.reportStartDay && usage.reportEndDay
            ? `${usage.reportStartDay}:${usage.reportEndDay}`
            : new Date().toISOString().slice(0, 10);
        const usageEvents = usage.users.map((u) => ({
          externalEventId: `copilot:${ctx.orgName}:${String(u.user_id ?? u.user_login ?? "unknown")}:${reportKey}`,
          externalUserId: u.user_login ?? String(u.user_id ?? "unknown"),
          occurredAt: new Date(u.report_end_day ?? u.day ?? usage.reportEndDay ?? Date.now()),
          requestCount: Number(u.ai_credits_used ?? 0),
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          product: "github_copilot",
          confidence: "imported" as const,
          metadata: {
            userId: u.user_id,
            aiCreditsUsed: u.ai_credits_used,
            usedChat: u.used_chat,
            usedCodeCompletions: u.used_code_completions,
            usedAgent: u.used_agent,
            usedCodeReview: u.used_code_review,
            usedCli: u.used_cli,
            aiAdoptionPhase: u.ai_adoption_phase,
            reportStartDay: usage.reportStartDay,
            reportEndDay: usage.reportEndDay,
            snapshotKind: "rolling_28_day",
            note: "Copilot reports AI credits and activity, not token-level provider cost; USD remains 0 unless reconciled from billing.",
          },
        }));

        return {
          status: "success",
          seats: normalizedSeats,
          usageEvents,
          latencyMs: Date.now() - started,
          warnings:
            usageEvents.length === 0
              ? ["No per-user Copilot metrics returned for the period."]
              : undefined,
        };
      } catch (err) {
        return {
          status: "failed",
          errorCode: "COPILOT_SYNC_FAILED",
          errorMessage: err instanceof Error ? err.message : "Copilot sync failed",
          latencyMs: Date.now() - started,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
