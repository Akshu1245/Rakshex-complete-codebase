/**
 * Multi-provider billing reconciliation worker (B4).
 *
 * Env (documented here; nothing else reads these):
 *   OPENAI_ADMIN_KEY              enables the OpenAI 15-min adapter. The
 *                                 actual fetch stays vault-backed inside
 *                                 reconcileOpenAiBilling (B3 owns the vault);
 *                                 this var is the enablement signal.
 *   ANTHROPIC_ADMIN_KEY           Anthropic ADMIN key (x-api-key header).
 *   GOOGLE_BILLING_EXPORT_BUCKET  GCS bucket holding the billing CSV export.
 *   GOOGLE_BILLING_EXPORT_PREFIX  Object prefix filter (default "").
 *   GOOGLE_BILLING_EXPORT_OAUTH_TOKEN  Bearer token for GCS reads.
 *                                 (Service-account JSON exchange is a
 *                                 follow-up; inject a short-lived token.)
 *   ANTHROPIC_CADENCE_MINUTES     5..15, default 5.
 *
 * HARD TRUTHS (read before "optimizing" this):
 * - Provider APIs are reconciliation-grade ONLY. OpenAI is hours late,
 *   Anthropic ~5min delayed, Google 24-48h late, ALL admin-key-only. This
 *   worker NEVER feeds the real-time enforcement gate — that is B1's local
 *   metering. This worker only reconciles and reports.
 * - Drift alerts are accounting signals for humans, not enforcement inputs.
 * - Missing keys -> the provider logs once per tick and is skipped:
 *   degraded, labeled "not_available", never throws, never blocks boot.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  type ProviderEvidenceRow,
  calculateReconciliation,
  DRIFT_LIMIT,
  reconcileOpenAiBilling,
} from "./openAiBillingReconciliation";
import {
  fetchAnthropicEvidence,
  normalizeAnthropicCosts,
} from "./anthropicReconciliation";
import {
  fetchLatestGoogleBillingCsv,
  parseGoogleBillingCsv,
} from "./googleBillingReconciliation";
import {
  RECONCILIATION_LABELS,
  type SignalLabel,
} from "./signalLabels";
import {
  providerBillingRows,
  providerReconciliationWindows,
} from "@rakshex/database/schema-billing";
import { teamAiUsageEvents } from "@rakshex/database/schema-enterprise";
import * as db from "../../db";

export type ProviderName = "openai" | "anthropic" | "google";

/**
 * control_plane_provider has no generic "google" value, so Google Cloud
 * billing export rows land in the "vertex" slot (Google's AI platform
 * value in this enum). Follow-up: add a "google" enum value via migration
 * if GCP-wide (non-AI) billing reconciliation becomes a real surface.
 */
export type DbProvider = "openai" | "anthropic" | "vertex";
const DB_PROVIDER: Record<ProviderName, DbProvider> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "vertex",
};

/** B2 wires its alert dispatcher to this. No B2 imports here — clean handoff. */
export interface DriftAlert {
  provider: ProviderName;
  workspaceId: number;
  providerAccountId: number;
  windowStart: Date;
  windowEnd: Date;
  providerReportedUsd: number;
  ledgerAttributedUsd: number;
  driftUsd: number;
  driftPct: number;
  providerLabel: SignalLabel;
  ledgerLabel: SignalLabel;
  /** Human-readable provider data latency, e.g. "hours late", "~5min delayed". */
  providerDataLatency: string;
}
export type OnDriftAlert = (alert: DriftAlert) => void | Promise<void>;

export interface WorkerTarget {
  workspaceId: number;
  providerAccountId: number;
}

export interface ProviderPlan {
  provider: ProviderName;
  enabled: boolean;
  missingKeys: string[];
  cadenceMs: number;
  dataLatency: string;
  providerLabel: SignalLabel;
}

function envGet(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

export function planProviders(
  env: Record<string, string | undefined> = process.env,
): ProviderPlan[] {
  const plans: ProviderPlan[] = [];
  const openAiKey = envGet(env, "OPENAI_ADMIN_KEY");
  plans.push({
    provider: "openai",
    enabled: !!openAiKey,
    missingKeys: openAiKey ? [] : ["OPENAI_ADMIN_KEY"],
    cadenceMs: 15 * 60_000,
    dataLatency: "hours late",
    providerLabel: RECONCILIATION_LABELS.openAiReportedCost,
  });

  const anthropicKey = envGet(env, "ANTHROPIC_ADMIN_KEY");
  const cadenceMinutes = Math.min(15, Math.max(5, Number(envGet(env, "ANTHROPIC_CADENCE_MINUTES")) || 5));
  plans.push({
    provider: "anthropic",
    enabled: !!anthropicKey,
    missingKeys: anthropicKey ? [] : ["ANTHROPIC_ADMIN_KEY"],
    cadenceMs: cadenceMinutes * 60_000,
    dataLatency: "~5min delayed",
    providerLabel: RECONCILIATION_LABELS.anthropicReportedCost,
  });

  const gcsBucket = envGet(env, "GOOGLE_BILLING_EXPORT_BUCKET");
  const gcsToken = envGet(env, "GOOGLE_BILLING_EXPORT_OAUTH_TOKEN");
  const gcsMissing = [
    ...(gcsBucket ? [] : ["GOOGLE_BILLING_EXPORT_BUCKET"]),
    ...(gcsToken ? [] : ["GOOGLE_BILLING_EXPORT_OAUTH_TOKEN"]),
  ];
  plans.push({
    provider: "google",
    enabled: gcsMissing.length === 0,
    missingKeys: gcsMissing,
    cadenceMs: 24 * 60 * 60_000,
    dataLatency: "24-48h late",
    providerLabel: RECONCILIATION_LABELS.googleExportedCost,
  });
  return plans;
}

export interface TickOutcome {
  provider: ProviderName;
  status: "reconciled" | "skipped" | "failed";
  missingKeys?: string[];
  error?: string;
  driftAlertSent?: boolean;
}

export interface ReconciliationStore {
  persistRows(
    workspaceId: number,
    providerAccountId: number,
    provider: DbProvider,
    rows: ProviderEvidenceRow[],
  ): Promise<void>;
  ledgerSumUsd(
    workspaceId: number,
    providerAccountId: number,
    provider: DbProvider,
    start: Date,
    end: Date,
  ): Promise<number>;
  writeWindow(input: {
    workspaceId: number;
    providerAccountId: number;
    provider: DbProvider;
    windowStart: Date;
    windowEnd: Date;
    providerBilledUsd: number;
    gatewayAttributedUsd: number;
    driftUsd: number;
    driftPct: number;
    status: "ok" | "drift";
    providerRowCount: number;
    gatewayRowCount: number;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export function createDrizzleStore(): ReconciliationStore {
  return {
    async persistRows(workspaceId, providerAccountId, provider, rows) {
      if (rows.length === 0) return;
      const database = await db.getDb();
      if (!database) throw new Error("Database unavailable");
      await database
        .insert(providerBillingRows)
        .values(
          rows.map((row) => ({
            workspaceId,
            providerAccountId,
            provider,
            rowKind: row.rowKind,
            sourceRowId: row.sourceRowId,
            bucketStart: row.bucketStart,
            bucketEnd: row.bucketEnd,
            projectId: row.projectId,
            apiKeyId: row.apiKeyId,
            lineItem: row.lineItem,
            model: row.model,
            amountUsd: row.amountUsd == null ? undefined : String(row.amountUsd),
            currency: row.currency,
            quantity: row.quantity == null ? undefined : String(row.quantity),
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            cachedInputTokens: row.cachedInputTokens,
            requestCount: row.requestCount,
            raw: row.raw,
          })),
        )
        .onConflictDoNothing();
    },

    async ledgerSumUsd(workspaceId, providerAccountId, provider, start, end) {
      const database = await db.getDb();
      if (!database) throw new Error("Database unavailable");
      const [row] = await database
        .select({ amount: sql<string>`coalesce(sum(${teamAiUsageEvents.costUsd}), 0)` })
        .from(teamAiUsageEvents)
        .where(
          and(
            eq(teamAiUsageEvents.workspaceId, workspaceId),
            eq(teamAiUsageEvents.providerAccountId, providerAccountId),
            eq(teamAiUsageEvents.provider, provider),
            eq(teamAiUsageEvents.source, "gateway"),
            gte(teamAiUsageEvents.occurredAt, start),
            lt(teamAiUsageEvents.occurredAt, end),
          ),
        );
      return Number(row?.amount ?? 0);
    },

    async writeWindow(input) {
      const database = await db.getDb();
      if (!database) throw new Error("Database unavailable");
      // NOTE: the unique target intentionally mirrors reconcileOpenAiBilling
      // (workspace, account, window) — schedule non-overlapping windows per
      // (workspace, providerAccountId) or reruns collapse into one snapshot.
      const values = {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        provider: input.provider,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        providerBilledUsd: String(input.providerBilledUsd),
        gatewayAttributedUsd: String(input.gatewayAttributedUsd),
        driftUsd: String(input.driftUsd),
        driftPct: String(input.driftPct),
        status: input.status,
        providerRowCount: input.providerRowCount,
        gatewayRowCount: input.gatewayRowCount,
        metadata: input.metadata,
      };
      await database
        .insert(providerReconciliationWindows)
        .values(values)
        .onConflictDoUpdate({
          target: [
            providerReconciliationWindows.workspaceId,
            providerReconciliationWindows.providerAccountId,
            providerReconciliationWindows.windowStart,
            providerReconciliationWindows.windowEnd,
          ],
          set: { ...values, reconciledAt: new Date() },
        });
    },
  };
}

export interface WorkerContext {
  env: Record<string, string | undefined>;
  onDrift: OnDriftAlert;
  log: (message: string, extra?: Record<string, unknown>) => void;
  now: () => Date;
  store: ReconciliationStore;
}

export function defaultContext(onDrift: OnDriftAlert): WorkerContext {
  return {
    env: process.env,
    onDrift,
    log: (message, extra) => console.log(`[reconciliation-worker] ${message}`, extra ?? ""),
    now: () => new Date(),
    store: createDrizzleStore(),
  };
}

function alignWindow(now: Date, cadenceMs: number): { start: Date; end: Date } {
  const endMs = Math.floor(now.getTime() / cadenceMs) * cadenceMs;
  return { start: new Date(endMs - cadenceMs), end: new Date(endMs) };
}

async function emitDriftIfNeeded(
  ctx: WorkerContext,
  input: {
    provider: ProviderName;
    plan: ProviderPlan;
    target: WorkerTarget;
    windowStart: Date;
    windowEnd: Date;
    providerBilledUsd: number;
    ledgerUsd: number;
    source: string;
    metadata?: Record<string, unknown>;
  },
): Promise<TickOutcome> {
  const result = calculateReconciliation(input.providerBilledUsd, input.ledgerUsd);
  await ctx.store.writeWindow({
    workspaceId: input.target.workspaceId,
    providerAccountId: input.target.providerAccountId,
    provider: DB_PROVIDER[input.provider],
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    providerBilledUsd: result.providerBilledUsd,
    gatewayAttributedUsd: result.gatewayAttributedUsd,
    driftUsd: result.driftUsd,
    driftPct: result.driftPct,
    status: result.status,
    providerRowCount: 0,
    gatewayRowCount: 0,
    metadata: {
      source: input.source,
      driftThreshold: DRIFT_LIMIT,
      providerLabel: input.plan.providerLabel,
      ledgerLabel: RECONCILIATION_LABELS.ledgerAttributedCost,
      providerDataLatency: input.plan.dataLatency,
      ...(input.metadata ?? {}),
    },
  });

  if (result.status === "drift") {
    await ctx.onDrift({
      provider: input.provider,
      workspaceId: input.target.workspaceId,
      providerAccountId: input.target.providerAccountId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      providerReportedUsd: result.providerBilledUsd,
      ledgerAttributedUsd: result.gatewayAttributedUsd,
      driftUsd: result.driftUsd,
      driftPct: result.driftPct,
      providerLabel: input.plan.providerLabel,
      ledgerLabel: RECONCILIATION_LABELS.ledgerAttributedCost,
      providerDataLatency: input.plan.dataLatency,
    });
    ctx.log("drift above threshold", {
      provider: input.provider,
      driftPct: result.driftPct,
      workspaceId: input.target.workspaceId,
    });
  }
  return { provider: input.provider, status: "reconciled", driftAlertSent: result.status === "drift" };
}

function skipOutcome(provider: ProviderName, missingKeys: string[], ctx: WorkerContext): TickOutcome {
  ctx.log("provider skipped: missing keys", { provider, missingKeys });
  return { provider, status: "skipped", missingKeys };
}

export async function runAnthropicTick(
  target: WorkerTarget,
  plan: ProviderPlan,
  ctx: WorkerContext,
): Promise<TickOutcome> {
  if (!plan.enabled) return skipOutcome("anthropic", plan.missingKeys, ctx);
  const adminKey = envGet(ctx.env, "ANTHROPIC_ADMIN_KEY")!;
  const { start, end } = alignWindow(ctx.now(), plan.cadenceMs);
  try {
    const { costRows, usageRows } = await fetchAnthropicEvidence(adminKey, start, end);
    const nonUsd = costRows.filter((r) => r.currency && r.currency !== "usd");
    if (nonUsd.length > 0) {
      throw new Error("Anthropic returned non-USD cost rows; reconciliation requires USD source rows");
    }
    await ctx.store.persistRows(target.workspaceId, target.providerAccountId, "anthropic", [
      ...costRows,
      ...usageRows,
    ]);
    const providerBilledUsd = costRows.reduce((sum, r) => sum + (r.amountUsd ?? 0), 0);
    const ledgerUsd = await ctx.store.ledgerSumUsd(
      target.workspaceId,
      target.providerAccountId,
      "anthropic",
      start,
      end,
    );
    return await emitDriftIfNeeded(ctx, {
      provider: "anthropic",
      plan,
      target,
      windowStart: start,
      windowEnd: end,
      providerBilledUsd,
      ledgerUsd,
      source: "anthropic_admin_api",
      metadata: { costRowCount: costRows.length, usageRowCount: usageRows.length },
    });
  } catch (error) {
    // A failed provider fetch is NEVER presented as a zero-drift window:
    // the window write is skipped, the run is marked failed, and the
    // missing-data label applies — no fabricated numbers anywhere.
    ctx.log("anthropic tick failed", { error: String(error) });
    return { provider: "anthropic", status: "failed", error: String(error) };
  }
}

export async function runGoogleTick(
  target: WorkerTarget,
  plan: ProviderPlan,
  ctx: WorkerContext,
): Promise<TickOutcome> {
  if (!plan.enabled) return skipOutcome("google", plan.missingKeys, ctx);
  const bucket = envGet(ctx.env, "GOOGLE_BILLING_EXPORT_BUCKET")!;
  const oauthToken = envGet(ctx.env, "GOOGLE_BILLING_EXPORT_OAUTH_TOKEN")!;
  // Billing export lags 24-48h: reconcile the full day before yesterday (UTC).
  const dayMs = 24 * 60 * 60_000;
  const todayUtc = Math.floor(ctx.now().getTime() / dayMs) * dayMs;
  const start = new Date(todayUtc - 2 * dayMs);
  const end = new Date(todayUtc - dayMs);
  try {
    const csv = await fetchLatestGoogleBillingCsv({
      bucket,
      prefix: envGet(ctx.env, "GOOGLE_BILLING_EXPORT_PREFIX") ?? "",
      oauthToken,
    });
    const costRows = parseGoogleBillingCsv(csv);
    const nonUsd = costRows.filter((r) => r.currency && r.currency !== "usd");
    if (nonUsd.length > 0) {
      throw new Error("Google export returned non-USD cost rows; reconciliation requires USD source rows");
    }
    await ctx.store.persistRows(target.workspaceId, target.providerAccountId, "vertex", costRows);
    const providerBilledUsd = costRows.reduce((sum, r) => sum + (r.amountUsd ?? 0), 0);
    const ledgerUsd = await ctx.store.ledgerSumUsd(
      target.workspaceId,
      target.providerAccountId,
      "vertex",
      start,
      end,
    );
    return await emitDriftIfNeeded(ctx, {
      provider: "google",
      plan,
      target,
      windowStart: start,
      windowEnd: end,
      providerBilledUsd,
      ledgerUsd,
      source: "google_billing_export_csv_gcs",
      metadata: {
        costRowCount: costRows.length,
        bucket,
        restatementRisk: "export rows can restate within the month as credits/adjustments land",
      },
    });
  } catch (error) {
    ctx.log("google tick failed", { error: String(error) });
    return { provider: "google", status: "failed", error: String(error) };
  }
}

export async function runOpenAiTick(
  target: WorkerTarget,
  plan: ProviderPlan,
  ctx: WorkerContext,
): Promise<TickOutcome> {
  if (!plan.enabled) return skipOutcome("openai", plan.missingKeys, ctx);
  const { start, end } = alignWindow(ctx.now(), plan.cadenceMs);
  try {
    // Delegates to the existing vault-backed reconciler (B4 does not touch
    // the credential path). It writes its own window + rows.
    const result = await reconcileOpenAiBilling({
      workspaceId: target.workspaceId,
      providerAccountId: target.providerAccountId,
      start,
      end,
    });
    if (result.status === "drift") {
      await ctx.onDrift({
        provider: "openai",
        workspaceId: target.workspaceId,
        providerAccountId: target.providerAccountId,
        windowStart: start,
        windowEnd: end,
        providerReportedUsd: result.providerBilledUsd,
        ledgerAttributedUsd: result.gatewayAttributedUsd,
        driftUsd: result.driftUsd,
        driftPct: result.driftPct,
        providerLabel: plan.providerLabel,
        ledgerLabel: RECONCILIATION_LABELS.ledgerAttributedCost,
        providerDataLatency: plan.dataLatency,
      });
      ctx.log("drift above threshold", {
        provider: "openai",
        driftPct: result.driftPct,
        workspaceId: target.workspaceId,
      });
    }
    return { provider: "openai", status: "reconciled", driftAlertSent: result.status === "drift" };
  } catch (error) {
    ctx.log("openai tick failed", { error: String(error) });
    return { provider: "openai", status: "failed", error: String(error) };
  }
}

/** Tick all configured targets for one provider; one target's failure never kills the rest. */
export async function runProviderTicks(
  provider: ProviderName,
  targets: WorkerTarget[],
  ctx: WorkerContext,
): Promise<TickOutcome[]> {
  const plans = planProviders(ctx.env);
  const plan = plans.find((p) => p.provider === provider)!;
  const runner =
    provider === "openai" ? runOpenAiTick : provider === "anthropic" ? runAnthropicTick : runGoogleTick;
  const outcomes: TickOutcome[] = [];
  for (const target of targets) {
    try {
      outcomes.push(await runner(target, plan, ctx));
    } catch (error) {
      // Belt and braces: a runner must never throw out of the schedule.
      ctx.log("tick crashed", { provider, error: String(error) });
      outcomes.push({ provider, status: "failed", error: String(error) });
    }
  }
  return outcomes;
}

export interface WorkerOptions {
  targets: Record<ProviderName, WorkerTarget[]>;
  onDrift: OnDriftAlert;
  env?: Record<string, string | undefined>;
  log?: WorkerContext["log"];
}

/**
 * Start the reconciliation schedules. Fire-and-forget: the first tick runs
 * async immediately, intervals follow. Never throws out of scheduling and
 * never blocks boot — each provider's tick degrades independently.
 */
export function startReconciliationWorker(options: WorkerOptions): { stop: () => void } {
  const ctx: WorkerContext = {
    ...defaultContext(options.onDrift),
    env: options.env ?? process.env,
    log: options.log ?? defaultContext(options.onDrift).log,
    now: () => new Date(),
  };
  const timers: NodeJS.Timeout[] = [];
  for (const plan of planProviders(ctx.env)) {
    const targets = options.targets[plan.provider] ?? [];
    if (targets.length === 0) {
      ctx.log("no targets configured; provider idle", { provider: plan.provider });
      continue;
    }
    const tickAll = () => {
      void runProviderTicks(plan.provider, targets, ctx);
    };
    tickAll();
    timers.push(setInterval(tickAll, plan.cadenceMs));
    if (typeof timers[timers.length - 1]!.unref === "function") {
      timers[timers.length - 1]!.unref();
    }
  }
  return {
    stop: () => {
      for (const t of timers) clearInterval(t);
    },
  };
}

export const __test = {
  planProviders,
  alignWindow,
  calculateReconciliation,
  DRIFT_LIMIT,
  normalizeAnthropicCosts,
};
