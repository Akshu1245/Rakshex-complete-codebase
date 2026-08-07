/**
 * Cursor Enterprise Admin API adapter.
 * Base URL is configurable (CURSOR_ADMIN_API_BASE); defaults to https://api.cursor.com.
 * Documented surface: https://docs.cursor.com/en/account/teams/admin-api
 */
import { logger } from "../../../_core/logger";
import type {
  AdapterSyncContext,
  AdapterSyncResult,
  NormalizedUsageEvent,
  SetSpendLimitResult,
  TeamGovernanceAdapter,
} from "../types";
import { getGovernanceCapabilities } from "../capabilities";

const DEFAULT_BASE = process.env.CURSOR_ADMIN_API_BASE || "https://api.cursor.com";
const FETCH_TIMEOUT_MS = 20_000;

interface CursorMember {
  id?: string | number;
  userId?: string | number;
  email?: string;
  name?: string;
  role?: string;
  isRemoved?: boolean;
  spendCents?: number;
  hardLimitOverrideDollars?: number | null;
}

interface CursorSpendRow {
  userId?: string | number;
  email?: string;
  name?: string;
  role?: string;
  spendCents?: number;
  overallSpendCents?: number;
  fastPremiumRequests?: number;
  hardLimitOverrideDollars?: number | null;
  monthlyLimitDollars?: number | null;
  effectivePerUserLimitDollars?: number | null;
}

function authHeaders(adminCredential: string): HeadersInit {
  const basic = Buffer.from(`${adminCredential}:`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function cursorFetch(
  baseUrl: string,
  path: string,
  adminCredential: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: { ...authHeaders(adminCredential), ...(init?.headers ?? {}) },
        signal: controller.signal,
      });
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
      if (attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        const waitMs = retryAfter > 0 ? Math.min(retryAfter * 1_000, 10_000) : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    throw new Error("Cursor Admin API retry limit exceeded");
  } finally {
    clearTimeout(timer);
  }
}

export function createCursorAdapter(): TeamGovernanceAdapter {
  return {
    provider: "cursor",
    capabilities: getGovernanceCapabilities("cursor"),
    async sync(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
      const started = Date.now();
      if (!ctx.adminCredential) {
        return {
          status: "not_configured",
          errorCode: "NOT_CONFIGURED",
          errorMessage:
            "Cursor sync requires a team Admin API key stored as an admin credential. Personal Cursor accounts cannot be governed.",
          latencyMs: Date.now() - started,
        };
      }

      const baseUrl = ctx.baseUrl || DEFAULT_BASE;
      try {
        const membersRes = await cursorFetch(baseUrl, "/teams/members", ctx.adminCredential);
        if (!membersRes.ok) {
          const body = await membersRes.text().catch(() => "");
          return {
            status: "failed",
            errorCode: `CURSOR_HTTP_${membersRes.status}`,
            errorMessage: `Cursor members fetch failed (${membersRes.status}): ${body.slice(0, 200)}`,
            latencyMs: Date.now() - started,
          };
        }

        const membersJson = (await membersRes.json()) as
          { teamMembers?: CursorMember[]; members?: CursorMember[] } | CursorMember[];
        const members = Array.isArray(membersJson)
          ? membersJson
          : (membersJson.teamMembers ?? membersJson.members ?? []);

        const seats = members.map((m) => {
          const externalUserId = String(m.id ?? m.userId ?? m.email ?? "unknown");
          return {
            externalUserId,
            email: m.email,
            displayName: m.name ?? m.email,
            role: m.role,
            status: m.isRemoved ? ("inactive" as const) : ("active" as const),
            metadata: {
              spendCents: m.spendCents,
              hardLimitOverrideDollars: m.hardLimitOverrideDollars,
            },
          };
        });

        const usageEvents: NormalizedUsageEvent[] = [];
        let spendWarning: string | undefined;
        let spendPage = 1;
        let totalPages = 1;
        let subscriptionCycleStart = Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          1,
        );
        do {
          const spendRes = await cursorFetch(baseUrl, "/teams/spend", ctx.adminCredential, {
            method: "POST",
            body: JSON.stringify({ page: spendPage, pageSize: 500 }),
          }).catch((err) => {
            logger.warn({ err }, "[CursorAdapter] spend fetch failed");
            return null;
          });
          if (!spendRes?.ok) {
            spendWarning = spendRes
              ? `Spend sync returned HTTP ${spendRes.status}; members synced.`
              : "Spend sync failed; members synced.";
            break;
          }
          const spendJson = (await spendRes.json()) as {
            teamMemberSpend?: CursorSpendRow[];
            spend?: CursorSpendRow[];
            totalPages?: number;
            subscriptionCycleStart?: number;
          };
          const rows = spendJson.teamMemberSpend ?? spendJson.spend ?? [];
          totalPages = Math.max(1, Number(spendJson.totalPages ?? 1));
          if (Number.isFinite(spendJson.subscriptionCycleStart)) {
            subscriptionCycleStart = Number(spendJson.subscriptionCycleStart);
          }
          const cycleKey = new Date(subscriptionCycleStart).toISOString().slice(0, 10);
          for (const row of rows) {
            const externalUserId = String(row.userId ?? row.email ?? "unknown");
            usageEvents.push({
              // This is a mutable billing-cycle snapshot. ingestUsageBatch
              // upserts this stable ID so repeated syncs do not double-count.
              externalEventId: `cursor:spend:${externalUserId}:${cycleKey}`,
              externalUserId,
              email: row.email,
              occurredAt: new Date(subscriptionCycleStart),
              costUsd: (row.overallSpendCents ?? row.spendCents ?? 0) / 100,
              requestCount: row.fastPremiumRequests ?? 0,
              product: "cursor",
              confidence: "verified",
              metadata: {
                spendCents: row.spendCents,
                overallSpendCents: row.overallSpendCents,
                fastPremiumRequests: row.fastPremiumRequests,
                monthlyLimitDollars: row.monthlyLimitDollars,
                hardLimitOverrideDollars: row.hardLimitOverrideDollars,
                effectivePerUserLimitDollars: row.effectivePerUserLimitDollars,
                snapshotKind: "billing_cycle",
              },
            });
          }
          spendPage += 1;
        } while (spendPage <= totalPages && spendPage <= 100);

        return {
          status: spendWarning ? "partial" : "success",
          seats,
          usageEvents,
          latencyMs: Date.now() - started,
          warnings: spendWarning ? [spendWarning] : undefined,
        };
      } catch (err) {
        return {
          status: "failed",
          errorCode: "CURSOR_SYNC_FAILED",
          errorMessage: err instanceof Error ? err.message : "Cursor sync failed",
          latencyMs: Date.now() - started,
        };
      }
    },

    async setUserSpendLimit(
      ctx: AdapterSyncContext,
      externalUserId: string,
      limitUsd: number,
      email?: string,
    ): Promise<SetSpendLimitResult> {
      if (!ctx.adminCredential) {
        return {
          ok: false,
          mode: "provider_native",
          errorCode: "NOT_CONFIGURED",
          errorMessage: "Cursor admin credential required to set spend limits",
        };
      }
      if (!email) {
        return {
          ok: false,
          mode: "provider_native",
          errorCode: "IDENTITY_EMAIL_REQUIRED",
          errorMessage: `Cursor requires userEmail to set a spend limit; identity ${externalUserId} has no linked email`,
        };
      }
      const baseUrl = ctx.baseUrl || DEFAULT_BASE;
      try {
        const res = await cursorFetch(baseUrl, "/teams/user-spend-limit", ctx.adminCredential, {
          method: "POST",
          body: JSON.stringify({
            userEmail: email,
            spendLimitDollars: Math.ceil(limitUsd),
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            ok: false,
            mode: "provider_native",
            errorCode: `CURSOR_HTTP_${res.status}`,
            errorMessage: body.slice(0, 300) || `HTTP ${res.status}`,
          };
        }
        return { ok: true, mode: "provider_native" };
      } catch (err) {
        return {
          ok: false,
          mode: "provider_native",
          errorCode: "CURSOR_LIMIT_FAILED",
          errorMessage: err instanceof Error ? err.message : "Failed to set Cursor spend limit",
        };
      }
    },
  };
}
