import { getGovernanceCapabilities } from "../capabilities";
import type {
  AdapterSyncContext,
  AdapterSyncResult,
  NormalizedUsageEvent,
  TeamGovernanceAdapter,
} from "../types";

const OPENAI_ADMIN_BASE = "https://api.openai.com/v1/organization";
const FETCH_TIMEOUT_MS = 20_000;

type OpenAiPage = { data?: unknown[]; has_more?: boolean; last_id?: string };
type OpenAiBucket = {
  start_time?: unknown;
  end_time?: unknown;
  results?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function asUnixDate(value: unknown, fallback: Date) {
  const timestamp = asNumber(value);
  return timestamp > 0 ? new Date(timestamp * 1_000) : fallback;
}

function bucketKey(timestamp: unknown, projectId: unknown) {
  return `${asNumber(timestamp)}:${typeof projectId === "string" ? projectId : "organization"}`;
}

async function openAiAdminFetch(path: string, credential: string, signal: AbortSignal) {
  const response = await fetch(`${OPENAI_ADMIN_BASE}${path}`, {
    headers: { authorization: `Bearer ${credential}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "OpenAI rejected the connected Admin API credential"
        : `OpenAI Admin API returned ${response.status}`,
    );
  }
  return response.json();
}

async function listOpenAiUsers(credential: string, signal: AbortSignal) {
  const users: Record<string, unknown>[] = [];
  let after: string | undefined;
  for (let page = 0; page < 25; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const payload = (await openAiAdminFetch(
      `/users?${query.toString()}`,
      credential,
      signal,
    )) as OpenAiPage;
    users.push(...(payload.data ?? []).map(asRecord));
    if (!payload.has_more || !payload.last_id) break;
    after = payload.last_id;
  }
  return users;
}

export function createOpenAiAdapter(): TeamGovernanceAdapter {
  return {
    provider: "openai",
    capabilities: getGovernanceCapabilities("openai"),
    async sync(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
      const started = Date.now();
      if (!ctx.adminCredential) {
        return {
          status: "not_configured",
          errorCode: "NOT_CONFIGURED",
          errorMessage:
            "OpenAI telemetry requires a customer authorized organization Admin API key. Inference keys are not used for this connector.",
          latencyMs: Date.now() - started,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const since = Math.floor(
          (ctx.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000)).getTime() / 1_000,
        );
        const end = Math.floor(Date.now() / 1_000);
        const usageQuery = new URLSearchParams({
          start_time: String(since),
          end_time: String(end),
          bucket_width: "1d",
          group_by: "project_id",
          limit: "180",
        });
        const costQuery = new URLSearchParams({
          start_time: String(since),
          end_time: String(end),
          bucket_width: "1d",
          group_by: "project_id",
          limit: "180",
        });
        const [users, usagePayload, costPayload] = await Promise.all([
          listOpenAiUsers(ctx.adminCredential, controller.signal),
          openAiAdminFetch(
            `/usage/completions?${usageQuery.toString()}`,
            ctx.adminCredential,
            controller.signal,
          ),
          openAiAdminFetch(
            `/costs?${costQuery.toString()}`,
            ctx.adminCredential,
            controller.signal,
          ),
        ]);

        const costByBucket = new Map<string, number>();
        for (const rawBucket of asArray(asRecord(costPayload).data)) {
          const bucket = asRecord(rawBucket) as OpenAiBucket;
          for (const rawResult of bucket.results ?? []) {
            const result = asRecord(rawResult);
            const amount = asRecord(result.amount);
            const currency =
              typeof amount.currency === "string" ? amount.currency.toUpperCase() : "USD";
            if (currency !== "USD") continue;
            const key = bucketKey(bucket.end_time, result.project_id);
            costByBucket.set(key, (costByBucket.get(key) ?? 0) + asNumber(amount.value));
          }
        }

        const usageEvents: NormalizedUsageEvent[] = [];
        for (const rawBucket of asArray(asRecord(usagePayload).data)) {
          const bucket = asRecord(rawBucket) as OpenAiBucket;
          for (const rawResult of bucket.results ?? []) {
            const result = asRecord(rawResult);
            const projectId =
              typeof result.project_id === "string" ? result.project_id : "organization";
            const occurredAt = asUnixDate(bucket.end_time, new Date());
            const inputTokens = asNumber(result.input_tokens);
            const outputTokens = asNumber(result.output_tokens);
            const requestCount = asNumber(result.num_model_requests);
            const eventKey = bucketKey(bucket.end_time, result.project_id);
            usageEvents.push({
              externalEventId: `openai:${ctx.providerAccountId ?? "organization"}:${eventKey}`,
              occurredAt,
              requestCount,
              inputTokens,
              outputTokens,
              costUsd: costByBucket.get(eventKey) ?? 0,
              product: "openai_api",
              confidence: "verified",
              metadata: {
                projectId,
                source: "openai_admin_api",
                aggregate: "daily_project",
                bucketStart: asNumber(bucket.start_time),
                bucketEnd: asNumber(bucket.end_time),
              },
            });
          }
        }

        return {
          status: "success",
          seats: users
            .filter((user) => typeof user.id === "string")
            .map((user) => ({
              externalUserId: String(user.id),
              email: typeof user.email === "string" ? user.email : undefined,
              displayName: typeof user.name === "string" ? user.name : undefined,
              role: typeof user.role === "string" ? user.role : undefined,
              status: "active" as const,
              metadata: { source: "openai_admin_api", role: user.role },
            })),
          usageEvents,
          latencyMs: Date.now() - started,
          warnings:
            usageEvents.length === 0
              ? ["OpenAI returned no completion usage buckets for the requested period."]
              : undefined,
        };
      } catch (error) {
        return {
          status: "failed",
          errorCode: "OPENAI_ADMIN_SYNC_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "OpenAI administration sync failed",
          latencyMs: Date.now() - started,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
