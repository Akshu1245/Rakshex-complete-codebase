/**
 * Team AI governance service — identities, usage, budgets, seats, sync, kill switches.
 * Never stores raw prompts or plaintext provider credentials.
 */
import { and, desc, eq, gte, isNull, lte, sql, sum } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  aiSubscriptionSeats,
  aiSubscriptions,
  controlPlaneCredentials,
  controlPlaneDiscoveryFindings,
  providerAccounts,
  providerSyncRuns,
  runtimeKillSwitches,
  teamAiBudgets,
  teamAiIdentities,
  teamAiUsageEvents,
} from "@rakshex/database/schema-enterprise";
import { connectorCheckpoints } from "@rakshex/database";
import type { ControlPlaneProvider } from "./controlPlane/providerRegistry";
import { decryptSecret } from "./vault";
import {
  getGovernanceAdapter,
  listGovernanceCapabilityCatalog,
} from "./teamGovernance/adapters/registry";
import { getGovernanceCapabilities } from "./teamGovernance/capabilities";
import {
  USAGE_INGEST_MAX_BATCH,
  type GovernanceProvider,
  type NormalizedSeat,
  type NormalizedUsageEvent,
} from "./teamGovernance/types";
import { publishScopedKillSwitch, readMergedKillSwitchState } from "./gateway/killSwitchCache";
import { toNumber } from "../utils/decimal";

function noDb(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
}

function periodStartMonthly(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function listIdentities(workspaceId: number) {
  const database = await db.getDb();
  if (!database) return [];
  return database
    .select()
    .from(teamAiIdentities)
    .where(eq(teamAiIdentities.workspaceId, workspaceId))
    .orderBy(desc(teamAiIdentities.updatedAt));
}

/**
 * Returns the identity id only when it belongs to the given workspace.
 * Used by the gateway and usage ingest so callers cannot attach foreign
 * tenant identity metadata via a guessed serial id.
 */
export async function resolveWorkspaceIdentityId(
  workspaceId: number,
  identityId: number | undefined,
): Promise<number | undefined> {
  if (identityId == null) return undefined;
  const database = await db.getDb();
  if (!database) {
    throw new Error("Governance database unavailable — identity resolution is fail-closed");
  }
  const [row] = await database
    .select({ id: teamAiIdentities.id })
    .from(teamAiIdentities)
    .where(and(eq(teamAiIdentities.id, identityId), eq(teamAiIdentities.workspaceId, workspaceId)))
    .limit(1);
  return row?.id;
}

export async function linkIdentityToMember(
  workspaceId: number,
  identityId: number,
  workspaceUserId: number,
) {
  const database = await db.getDb();
  if (!database) noDb();
  const membership = await db.getWorkspaceMembership(workspaceId, workspaceUserId);
  if (!membership || !membership.active) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "workspace member not found or inactive" });
  }
  const [row] = await database!
    .update(teamAiIdentities)
    .set({ workspaceUserId, updatedAt: new Date() })
    .where(and(eq(teamAiIdentities.id, identityId), eq(teamAiIdentities.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "identity not found" });
  return row;
}

export async function upsertIdentityFromSeat(
  workspaceId: number,
  provider: ControlPlaneProvider,
  seat: NormalizedSeat,
  subscriptionSeatId?: number,
) {
  const database = await db.getDb();
  if (!database) noDb();
  const [row] = await database!
    .insert(teamAiIdentities)
    .values({
      workspaceId,
      provider,
      externalUserId: seat.externalUserId,
      email: seat.email?.toLowerCase(),
      displayName: seat.displayName,
      subscriptionSeatId,
      status: seat.status === "inactive" ? "inactive" : "active",
      metadata: seat.metadata,
    })
    .onConflictDoUpdate({
      target: [
        teamAiIdentities.workspaceId,
        teamAiIdentities.provider,
        teamAiIdentities.externalUserId,
      ],
      set: {
        email: seat.email?.toLowerCase(),
        displayName: seat.displayName,
        subscriptionSeatId,
        status: seat.status === "inactive" ? "inactive" : "active",
        metadata: seat.metadata,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function resolveOrCreateIdentity(opts: {
  workspaceId: number;
  provider: ControlPlaneProvider;
  externalUserId?: string;
  email?: string;
}) {
  const database = await db.getDb();
  if (!database) noDb();
  const externalUserId =
    opts.externalUserId?.trim() || (opts.email ? `email:${opts.email.toLowerCase()}` : null);
  if (!externalUserId) return null;

  const existing = await database!
    .select()
    .from(teamAiIdentities)
    .where(
      and(
        eq(teamAiIdentities.workspaceId, opts.workspaceId),
        eq(teamAiIdentities.provider, opts.provider),
        eq(teamAiIdentities.externalUserId, externalUserId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  return upsertIdentityFromSeat(opts.workspaceId, opts.provider, {
    externalUserId,
    email: opts.email,
    status: "active",
  });
}

export type IngestUsageItem = {
  externalEventId: string;
  provider: ControlPlaneProvider;
  source: "gateway" | "admin_api" | "analytics_api" | "cloud_billing" | "otel" | "csv" | "manual";
  occurredAt: Date;
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  model?: string;
  product?: string;
  confidence?: "verified" | "imported" | "estimated" | "inferred";
  externalUserId?: string;
  email?: string;
  identityId?: number;
  providerAccountId?: number;
  metadata?: Record<string, unknown>;
};

export async function ingestUsageBatch(workspaceId: number, events: IngestUsageItem[]) {
  if (events.length === 0) return { inserted: 0, skipped: 0 };
  if (events.length > USAGE_INGEST_MAX_BATCH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Batch exceeds max of ${USAGE_INGEST_MAX_BATCH} events`,
    });
  }
  const database = await db.getDb();
  if (!database) noDb();

  let inserted = 0;
  let skipped = 0;
  for (const ev of events) {
    // Strip any accidental prompt fields from metadata
    const meta = { ...(ev.metadata ?? {}) };
    delete meta.prompt;
    delete meta.rawPrompt;
    delete meta.messages;
    delete meta.content;

    let identityId = await resolveWorkspaceIdentityId(workspaceId, ev.identityId);
    if (ev.identityId != null && identityId == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "identityId does not belong to this workspace",
      });
    }
    if (!identityId && (ev.externalUserId || ev.email)) {
      const ident = await resolveOrCreateIdentity({
        workspaceId,
        provider: ev.provider,
        externalUserId: ev.externalUserId,
        email: ev.email,
      });
      identityId = ident?.id;
    }

    try {
      const result = await database!
        .insert(teamAiUsageEvents)
        .values({
          workspaceId,
          identityId,
          providerAccountId: ev.providerAccountId,
          provider: ev.provider,
          source: ev.source,
          externalEventId: ev.externalEventId,
          occurredAt: ev.occurredAt,
          requestCount: ev.requestCount ?? 1,
          inputTokens: ev.inputTokens ?? 0,
          outputTokens: ev.outputTokens ?? 0,
          costUsd: String(ev.costUsd ?? 0),
          model: ev.model,
          product: ev.product,
          confidence: ev.confidence ?? "imported",
          metadata: meta,
        })
        .onConflictDoUpdate({
          target: [teamAiUsageEvents.workspaceId, teamAiUsageEvents.externalEventId],
          set: {
            identityId,
            providerAccountId: ev.providerAccountId,
            provider: ev.provider,
            source: ev.source,
            occurredAt: ev.occurredAt,
            requestCount: ev.requestCount ?? 1,
            inputTokens: ev.inputTokens ?? 0,
            outputTokens: ev.outputTokens ?? 0,
            costUsd: String(ev.costUsd ?? 0),
            model: ev.model,
            product: ev.product,
            confidence: ev.confidence ?? "imported",
            metadata: meta,
          },
        })
        .returning({ id: teamAiUsageEvents.id });
      if (result.length > 0) inserted += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  await refreshBudgetSpend(workspaceId);
  return { inserted, skipped, rawPromptStored: false as const };
}

export async function usageSummary(workspaceId: number, opts?: { since?: Date; until?: Date }) {
  const database = await db.getDb();
  if (!database) {
    return {
      totalCostUsd: 0,
      totalRequests: 0,
      totalTokens: 0,
      byMember: [],
      byProvider: [],
      byModel: [],
      byDate: [],
    };
  }
  const since = opts?.since ?? periodStartMonthly();
  const until = opts?.until;
  if (until && until < since) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "until must be on or after since" });
  }
  const rows = await database
    .select({
      identityId: teamAiUsageEvents.identityId,
      provider: teamAiUsageEvents.provider,
      model: teamAiUsageEvents.model,
      occurredAt: teamAiUsageEvents.occurredAt,
      requestCount: teamAiUsageEvents.requestCount,
      inputTokens: teamAiUsageEvents.inputTokens,
      outputTokens: teamAiUsageEvents.outputTokens,
      costUsd: teamAiUsageEvents.costUsd,
      email: teamAiIdentities.email,
      displayName: teamAiIdentities.displayName,
      workspaceUserId: teamAiIdentities.workspaceUserId,
    })
    .from(teamAiUsageEvents)
    .leftJoin(
      teamAiIdentities,
      and(
        eq(teamAiUsageEvents.identityId, teamAiIdentities.id),
        eq(teamAiIdentities.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(teamAiUsageEvents.workspaceId, workspaceId),
        gte(teamAiUsageEvents.occurredAt, since),
        until ? lte(teamAiUsageEvents.occurredAt, until) : undefined,
      ),
    )
    .limit(10000);

  const byMember = new Map<
    string,
    {
      identityId: number | null;
      email: string | null;
      displayName: string | null;
      workspaceUserId: number | null;
      requests: number;
      tokens: number;
      costUsd: number;
    }
  >();
  const byProvider = new Map<
    string,
    { provider: string; requests: number; tokens: number; costUsd: number }
  >();
  const byModel = new Map<
    string,
    { provider: string; model: string; requests: number; tokens: number; costUsd: number }
  >();
  const byDate = new Map<
    string,
    { date: string; requests: number; tokens: number; costUsd: number }
  >();

  let totalCostUsd = 0;
  let totalRequests = 0;
  let totalTokens = 0;

  for (const r of rows) {
    const cost = Number(r.costUsd ?? 0);
    const tokens = (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
    const reqs = r.requestCount ?? 1;
    totalCostUsd += cost;
    totalRequests += reqs;
    totalTokens += tokens;

    const memberKey = String(r.identityId ?? "unattributed");
    const member = byMember.get(memberKey) ?? {
      identityId: r.identityId,
      email: r.email,
      displayName: r.displayName,
      workspaceUserId: r.workspaceUserId,
      requests: 0,
      tokens: 0,
      costUsd: 0,
    };
    member.requests += reqs;
    member.tokens += tokens;
    member.costUsd += cost;
    byMember.set(memberKey, member);

    const p = byProvider.get(r.provider) ?? {
      provider: r.provider,
      requests: 0,
      tokens: 0,
      costUsd: 0,
    };
    p.requests += reqs;
    p.tokens += tokens;
    p.costUsd += cost;
    byProvider.set(r.provider, p);

    const modelKey = `${r.provider}:${r.model ?? "unknown"}`;
    const m = byModel.get(modelKey) ?? {
      provider: r.provider,
      model: r.model ?? "unknown",
      requests: 0,
      tokens: 0,
      costUsd: 0,
    };
    m.requests += reqs;
    m.tokens += tokens;
    m.costUsd += cost;
    byModel.set(modelKey, m);

    const date = r.occurredAt.toISOString().slice(0, 10);
    const d = byDate.get(date) ?? { date, requests: 0, tokens: 0, costUsd: 0 };
    d.requests += reqs;
    d.tokens += tokens;
    d.costUsd += cost;
    byDate.set(date, d);
  }

  const sortCost = <T extends { costUsd: number }>(items: T[]) =>
    items
      .sort((a, b) => b.costUsd - a.costUsd)
      .map((i) => ({ ...i, costUsd: Number(i.costUsd.toFixed(6)) }));

  return {
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    totalRequests,
    totalTokens,
    periodStart: since.toISOString(),
    periodEnd: until?.toISOString() ?? null,
    byMember: sortCost([...byMember.values()]),
    byProvider: sortCost([...byProvider.values()]),
    byModel: sortCost([...byModel.values()]),
    byDate: [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((i) => ({ ...i, costUsd: Number(i.costUsd.toFixed(6)) })),
  };
}

async function computeSpend(workspaceId: number, identityId: number | null, since: Date) {
  const database = await db.getDb();
  if (!database) return 0;
  const conditions = [
    eq(teamAiUsageEvents.workspaceId, workspaceId),
    gte(teamAiUsageEvents.occurredAt, since),
  ];
  if (identityId == null) {
    // workspace total
  } else {
    conditions.push(eq(teamAiUsageEvents.identityId, identityId));
  }
  const [row] = await database
    .select({ total: sum(teamAiUsageEvents.costUsd) })
    .from(teamAiUsageEvents)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export async function refreshBudgetSpend(workspaceId: number) {
  const database = await db.getDb();
  if (!database) return;
  const budgets = await database
    .select()
    .from(teamAiBudgets)
    .where(eq(teamAiBudgets.workspaceId, workspaceId));
  const since = periodStartMonthly();
  for (const b of budgets) {
    const spend = await computeSpend(workspaceId, b.identityId, since);
    await database
      .update(teamAiBudgets)
      .set({
        currentSpendUsd: String(spend),
        periodStart: since,
        updatedAt: new Date(),
      })
      .where(eq(teamAiBudgets.id, b.id));
  }
}

function budgetStatus(limitUsd: number, spendUsd: number, warningPct: number) {
  if (limitUsd <= 0) return "unlimited" as const;
  const pct = (spendUsd / limitUsd) * 100;
  if (pct >= 100) return "exceeded" as const;
  if (pct >= warningPct) return "warning" as const;
  return "ok" as const;
}

export async function listBudgets(workspaceId: number) {
  const database = await db.getDb();
  if (!database) return [];
  await refreshBudgetSpend(workspaceId);
  const rows = await database
    .select()
    .from(teamAiBudgets)
    .where(eq(teamAiBudgets.workspaceId, workspaceId));
  return rows.map((b) => {
    const limitUsd = toNumber(b.limitUsd);
    const spendUsd = toNumber(b.currentSpendUsd);
    return {
      ...b,
      limitUsd,
      currentSpendUsd: spendUsd,
      status: budgetStatus(limitUsd, spendUsd, b.warningPct),
      hardLimitHonest:
        b.hardLimit && b.enforcementMode === "monitor_only"
          ? "hardLimit ignored for monitor_only — alerts only, no RakshEx block claim"
          : b.hardLimit && b.enforcementMode === "provider_native"
            ? "provider_native limit attempted via admin API when supported"
            : b.hardLimit
              ? "gateway hard limit applies to RakshEx-routed traffic only"
              : null,
    };
  });
}

export async function upsertBudget(input: {
  workspaceId: number;
  identityId?: number | null;
  limitUsd: number;
  warningPct?: number;
  hardLimit?: boolean;
  enforcementMode: "gateway" | "provider_native" | "monitor_only";
}) {
  if (input.hardLimit && input.enforcementMode === "monitor_only") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "hardLimit=true is invalid with enforcementMode=monitor_only. Use gateway or provider_native for hard enforcement, or set hardLimit=false for alerts-only.",
    });
  }
  if (input.enforcementMode === "provider_native" && input.identityId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "provider_native budgets require an identityId (Cursor user spend limits are per-user).",
    });
  }

  const database = await db.getDb();
  if (!database) noDb();
  const since = periodStartMonthly();
  const spend = await computeSpend(input.workspaceId, input.identityId ?? null, since);

  const existing = await database!
    .select()
    .from(teamAiBudgets)
    .where(
      and(
        eq(teamAiBudgets.workspaceId, input.workspaceId),
        eq(teamAiBudgets.period, "monthly"),
        input.identityId == null
          ? isNull(teamAiBudgets.identityId)
          : eq(teamAiBudgets.identityId, input.identityId),
      ),
    )
    .limit(1);

  let row;
  if (existing[0]) {
    [row] = await database!
      .update(teamAiBudgets)
      .set({
        limitUsd: String(input.limitUsd),
        warningPct: input.warningPct ?? 80,
        hardLimit: input.hardLimit ?? false,
        enforcementMode: input.enforcementMode,
        currentSpendUsd: String(spend),
        periodStart: since,
        updatedAt: new Date(),
      })
      .where(eq(teamAiBudgets.id, existing[0].id))
      .returning();
  } else {
    [row] = await database!
      .insert(teamAiBudgets)
      .values({
        workspaceId: input.workspaceId,
        identityId: input.identityId ?? null,
        period: "monthly",
        limitUsd: String(input.limitUsd),
        warningPct: input.warningPct ?? 80,
        hardLimit: input.hardLimit ?? false,
        enforcementMode: input.enforcementMode,
        currentSpendUsd: String(spend),
        periodStart: since,
      })
      .returning();
  }

  // Provider-native: attempt Cursor spend limit
  let providerNativeResult = null;
  if (input.enforcementMode === "provider_native" && input.identityId != null) {
    providerNativeResult = await applyProviderNativeLimit(
      input.workspaceId,
      input.identityId,
      input.limitUsd,
    );
  }

  return {
    ...row,
    limitUsd: toNumber(row!.limitUsd),
    currentSpendUsd: toNumber(row!.currentSpendUsd),
    status: budgetStatus(input.limitUsd, spend, input.warningPct ?? 80),
    providerNativeResult,
  };
}

export async function deleteBudget(workspaceId: number, budgetId: number) {
  const database = await db.getDb();
  if (!database) noDb();
  await database!
    .delete(teamAiBudgets)
    .where(and(eq(teamAiBudgets.id, budgetId), eq(teamAiBudgets.workspaceId, workspaceId)));
  return { ok: true };
}

async function applyProviderNativeLimit(workspaceId: number, identityId: number, limitUsd: number) {
  const database = await db.getDb();
  if (!database) return { ok: false, errorCode: "NO_DB" };
  const [identity] = await database
    .select()
    .from(teamAiIdentities)
    .where(and(eq(teamAiIdentities.id, identityId), eq(teamAiIdentities.workspaceId, workspaceId)))
    .limit(1);
  if (!identity) return { ok: false, errorCode: "IDENTITY_NOT_FOUND" };

  const caps = getGovernanceCapabilities(identity.provider as GovernanceProvider);
  if (!caps.providerNativeLimit) {
    return {
      ok: false,
      mode: "monitor_only" as const,
      errorCode: "NOT_SUPPORTED",
      errorMessage: `${identity.provider} does not support provider-native spend limits. Budget recorded as monitor_only.`,
    };
  }

  const adapter = getGovernanceAdapter(identity.provider);
  if (!adapter?.setUserSpendLimit) {
    return {
      ok: false,
      mode: "not_implemented" as const,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "Adapter cannot set spend limits",
    };
  }

  const adminCred = await loadAdminCredential(workspaceId, identity.provider);
  const result = await adapter.setUserSpendLimit(
    { workspaceId, adminCredential: adminCred ?? undefined },
    identity.externalUserId,
    limitUsd,
    identity.email ?? undefined,
  );
  return result;
}

async function loadAdminCredential(
  workspaceId: number,
  provider: string,
  providerAccountId?: number,
): Promise<string | null> {
  const database = await db.getDb();
  if (!database) return null;
  const accountFilters = [
    eq(providerAccounts.workspaceId, workspaceId),
    eq(providerAccounts.provider, provider as ControlPlaneProvider),
  ];
  if (providerAccountId) {
    accountFilters.push(eq(providerAccounts.id, providerAccountId));
  }
  const [account] = await database
    .select()
    .from(providerAccounts)
    .where(and(...accountFilters))
    .orderBy(desc(providerAccounts.updatedAt))
    .limit(1);
  if (!account?.adminCredentialId) return null;
  const [cred] = await database
    .select()
    .from(controlPlaneCredentials)
    .where(
      and(
        eq(controlPlaneCredentials.id, account.adminCredentialId),
        eq(controlPlaneCredentials.workspaceId, workspaceId),
        eq(controlPlaneCredentials.status, "active"),
      ),
    )
    .limit(1);
  if (!cred) return null;
  try {
    // Credentials are encrypted by controlPlane.credentials.create with this
    // exact tenant binding. Using only the numeric ID makes every real sync
    // credential undecryptable.
    return decryptSecret(cred.encryptedValue, `workspace:${workspaceId}`);
  } catch {
    return null;
  }
}

export async function importSeatsLinkIdentities(input: {
  workspaceId: number;
  subscriptionId: number;
  seats: Array<{
    externalUserId?: string;
    email?: string;
    displayName?: string;
    role?: string;
    status?: string;
  }>;
}) {
  const database = await db.getDb();
  if (!database) noDb();
  const [sub] = await database!
    .select()
    .from(aiSubscriptions)
    .where(
      and(
        eq(aiSubscriptions.id, input.subscriptionId),
        eq(aiSubscriptions.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "subscription not found" });

  let linked = 0;
  let created = 0;
  for (const seat of input.seats) {
    const externalUserId =
      seat.externalUserId?.trim() || (seat.email ? `email:${seat.email.toLowerCase()}` : null);
    if (!externalUserId) continue;

    // Dedupe existing seat by email or externalUserId
    const existingSeats = await database!
      .select()
      .from(aiSubscriptionSeats)
      .where(
        and(
          eq(aiSubscriptionSeats.workspaceId, input.workspaceId),
          eq(aiSubscriptionSeats.subscriptionId, input.subscriptionId),
          seat.email
            ? eq(aiSubscriptionSeats.email, seat.email.toLowerCase())
            : eq(aiSubscriptionSeats.externalUserId, externalUserId),
        ),
      )
      .limit(1);

    let seatId = existingSeats[0]?.id;
    if (!seatId) {
      const [inserted] = await database!
        .insert(aiSubscriptionSeats)
        .values({
          workspaceId: input.workspaceId,
          subscriptionId: input.subscriptionId,
          externalUserId,
          email: seat.email?.toLowerCase(),
          displayName: seat.displayName,
          role: seat.role,
          status: seat.status ?? "active",
          source: "manual",
          confidence: "imported",
          assignedAt: new Date(),
        })
        .returning({ id: aiSubscriptionSeats.id });
      seatId = inserted.id;
      created += 1;
    }

    await upsertIdentityFromSeat(
      input.workspaceId,
      sub.provider,
      {
        externalUserId,
        email: seat.email,
        displayName: seat.displayName,
        role: seat.role,
        status: (seat.status as "active") ?? "active",
      },
      seatId,
    );
    linked += 1;
  }

  const seatCount = await database!
    .select({ id: aiSubscriptionSeats.id })
    .from(aiSubscriptionSeats)
    .where(eq(aiSubscriptionSeats.subscriptionId, input.subscriptionId));
  await database!
    .update(aiSubscriptions)
    .set({ seatsUsed: seatCount.length, updatedAt: new Date() })
    .where(eq(aiSubscriptions.id, input.subscriptionId));

  return { linked, created, seatsUsed: seatCount.length };
}

export async function syncProvider(input: {
  workspaceId: number;
  provider: GovernanceProvider;
  providerAccountId?: number;
  orgName?: string;
  baseUrl?: string;
}) {
  const adapter = getGovernanceAdapter(input.provider);
  if (!adapter) {
    return {
      status: "not_implemented" as const,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: `No adapter registered for ${input.provider}`,
    };
  }

  const caps = adapter.capabilities;
  if (
    caps.implementationStatus === "not_implemented" ||
    caps.implementationStatus === "import_only"
  ) {
    const database = await db.getDb();
    if (database) {
      await database.insert(providerSyncRuns).values({
        workspaceId: input.workspaceId,
        provider: input.provider,
        status: "not_implemented",
        finishedAt: new Date(),
        latencyMs: 0,
        errorCode: "NOT_IMPLEMENTED",
        errorMessage: caps.note,
      });
    }
    return {
      status: "not_implemented" as const,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: caps.note,
      capabilities: caps,
    };
  }

  const database = await db.getDb();
  if (!database) noDb();

  const accountFilters = [
    eq(providerAccounts.workspaceId, input.workspaceId),
    eq(providerAccounts.provider, input.provider),
  ];
  if (input.providerAccountId) {
    accountFilters.push(eq(providerAccounts.id, input.providerAccountId));
  }
  const [account] = await database!
    .select()
    .from(providerAccounts)
    .where(and(...accountFilters))
    .orderBy(desc(providerAccounts.updatedAt))
    .limit(1);
  const providerAccountId = account?.id ?? input.providerAccountId;
  const adminCredential = await loadAdminCredential(
    input.workspaceId,
    input.provider,
    providerAccountId,
  );
  const [checkpoint] = providerAccountId
    ? await database!
        .select()
        .from(connectorCheckpoints)
        .where(eq(connectorCheckpoints.providerAccountId, providerAccountId))
        .limit(1)
    : [];

  const [run] = await database!
    .insert(providerSyncRuns)
    .values({
      workspaceId: input.workspaceId,
      provider: input.provider,
      providerAccountId,
      status: "running",
    })
    .returning();

  const result = await adapter.sync({
    workspaceId: input.workspaceId,
    providerAccountId,
    adminCredential: adminCredential ?? undefined,
    orgName: input.orgName ?? account?.externalId ?? undefined,
    baseUrl: input.baseUrl,
    since: checkpoint?.lastSyncedAt ?? periodStartMonthly(),
  });

  let seatsSynced = 0;
  let usageEventsSynced = 0;

  if (result.status === "success" || result.status === "partial") {
    for (const seat of result.seats) {
      await upsertIdentityFromSeat(input.workspaceId, input.provider, seat);
      seatsSynced += 1;
    }
    if (result.usageEvents.length > 0) {
      const ingest = await ingestUsageBatch(
        input.workspaceId,
        result.usageEvents.map((e: NormalizedUsageEvent) => ({
          externalEventId: e.externalEventId,
          provider: input.provider,
          source: "admin_api" as const,
          occurredAt: e.occurredAt,
          requestCount: e.requestCount,
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          costUsd: e.costUsd,
          model: e.model,
          product: e.product,
          confidence: e.confidence,
          externalUserId: e.externalUserId,
          email: e.email,
          metadata: e.metadata,
        })),
      );
      usageEventsSynced = ingest.inserted;
    }

    if (providerAccountId) {
      const syncedAt = new Date();
      await Promise.all([
        database!
          .update(providerAccounts)
          .set({
            syncStatus: result.status === "success" ? "healthy" : "degraded",
            lastSyncedAt: syncedAt,
            lastSyncError: result.warnings?.join("; ") ?? null,
            updatedAt: syncedAt,
          })
          .where(eq(providerAccounts.id, providerAccountId)),
        database!
          .insert(connectorCheckpoints)
          .values({
            workspaceId: input.workspaceId,
            providerAccountId,
            provider: input.provider,
            lastSyncedAt: syncedAt,
            metadata: { lastRunId: run.id, status: result.status },
          })
          .onConflictDoUpdate({
            target: connectorCheckpoints.providerAccountId,
            set: {
              provider: input.provider,
              lastSyncedAt: syncedAt,
              metadata: { lastRunId: run.id, status: result.status },
              updatedAt: syncedAt,
            },
          }),
      ]);
    }
  } else {
    if (providerAccountId) {
      await database!
        .update(providerAccounts)
        .set({
          syncStatus: result.status === "not_configured" ? "not_connected" : "failed",
          lastSyncError: "errorMessage" in result ? result.errorMessage : null,
          updatedAt: new Date(),
        })
        .where(eq(providerAccounts.id, providerAccountId));
    }
  }

  const syncStatus =
    result.status === "success"
      ? "success"
      : result.status === "partial"
        ? "partial"
        : result.status === "not_configured"
          ? "not_configured"
          : result.status === "not_implemented"
            ? "not_implemented"
            : "failed";

  await database!
    .update(providerSyncRuns)
    .set({
      status: syncStatus,
      finishedAt: new Date(),
      latencyMs: result.latencyMs,
      seatsSynced,
      usageEventsSynced,
      errorCode: "errorCode" in result ? result.errorCode : null,
      errorMessage: "errorMessage" in result ? result.errorMessage : null,
    })
    .where(eq(providerSyncRuns.id, run.id));

  return {
    ...result,
    seatsSynced,
    usageEventsSynced,
    capabilities: caps,
    runId: run.id,
  };
}

export async function healthStatus(workspaceId: number) {
  const database = await db.getDb();
  if (!database) return { providers: [], findingsOpen: 0 };
  const accounts = await database
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.workspaceId, workspaceId));
  const latestRuns = await database
    .select()
    .from(providerSyncRuns)
    .where(eq(providerSyncRuns.workspaceId, workspaceId))
    .orderBy(desc(providerSyncRuns.startedAt))
    .limit(100);

  const byProvider = new Map<string, (typeof latestRuns)[0]>();
  for (const run of latestRuns) {
    if (!byProvider.has(run.provider)) byProvider.set(run.provider, run);
  }

  const findings = await database
    .select({ id: controlPlaneDiscoveryFindings.id })
    .from(controlPlaneDiscoveryFindings)
    .where(
      and(
        eq(controlPlaneDiscoveryFindings.workspaceId, workspaceId),
        eq(controlPlaneDiscoveryFindings.status, "open"),
      ),
    );

  const now = Date.now();
  const providers = accounts.map((a) => {
    const last = byProvider.get(a.provider);
    const lastSuccessAt =
      last?.status === "success" || last?.status === "partial" ? last.finishedAt : a.lastSyncedAt;
    const staleMs = lastSuccessAt ? now - lastSuccessAt.getTime() : null;
    const caps = getGovernanceCapabilities(a.provider as GovernanceProvider);
    return {
      provider: a.provider,
      accountId: a.id,
      displayName: a.displayName,
      syncStatus: a.syncStatus,
      connectionStatus: a.connectionStatus,
      lastSyncedAt: a.lastSyncedAt,
      lastSyncError: a.lastSyncError,
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            startedAt: last.startedAt,
            finishedAt: last.finishedAt,
            latencyMs: last.latencyMs,
            errorCode: last.errorCode,
            errorMessage: last.errorMessage,
          }
        : null,
      staleMs,
      stale: staleMs != null ? staleMs > 24 * 60 * 60 * 1000 : true,
      capabilities: caps,
    };
  });

  return { providers, findingsOpen: findings.length };
}

export function capabilitiesCatalog() {
  return listGovernanceCapabilityCatalog();
}

export async function setKillSwitch(input: {
  workspaceId: number;
  scopeType: "workspace" | "identity" | "project" | "agent";
  scopeId: string;
  active: boolean;
  reason?: string;
  setBy: number;
}) {
  const database = await db.getDb();
  if (!database) noDb();

  const existing = await database!
    .select()
    .from(runtimeKillSwitches)
    .where(
      and(
        eq(runtimeKillSwitches.workspaceId, input.workspaceId),
        eq(runtimeKillSwitches.scopeType, input.scopeType),
        eq(runtimeKillSwitches.scopeId, input.scopeId),
      ),
    )
    .limit(1);

  let row;
  if (existing[0]) {
    const nextVersion = existing[0].version + 1;
    [row] = await database!
      .update(runtimeKillSwitches)
      .set({
        active: input.active,
        reason: input.reason,
        setBy: input.setBy,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(runtimeKillSwitches.id, existing[0].id))
      .returning();
  } else {
    [row] = await database!
      .insert(runtimeKillSwitches)
      .values({
        workspaceId: input.workspaceId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        active: input.active,
        reason: input.reason,
        setBy: input.setBy,
        version: 1,
      })
      .returning();
  }

  await publishScopedKillSwitch({
    workspaceId: input.workspaceId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    active: input.active,
    version: row!.version,
    reason: input.reason,
  });

  return row;
}

export async function listKillSwitches(workspaceId: number) {
  const database = await db.getDb();
  if (!database) return [];
  return database
    .select()
    .from(runtimeKillSwitches)
    .where(eq(runtimeKillSwitches.workspaceId, workspaceId))
    .orderBy(desc(runtimeKillSwitches.updatedAt));
}

export async function evaluateGatewayGovernance(opts: {
  workspaceId: number;
  identityId?: number;
  projectId?: string;
  agentId?: string;
  estimatedCostUsd?: number;
}) {
  const database = await db.getDb();
  if (!database) {
    throw new Error("Governance database unavailable — gateway enforcement is fail-closed");
  }

  // Redis is the low-latency propagation path, while Postgres is durable truth.
  // Always reconcile both before allowing a provider request. This prevents a
  // Redis miss/eviction/outage from silently clearing an active kill switch.
  const [cachedState, durableSwitches] = await Promise.all([
    readMergedKillSwitchState({
      workspaceId: opts.workspaceId,
      identityId: opts.identityId,
      projectId: opts.projectId,
      agentId: opts.agentId,
    }),
    database
      .select()
      .from(runtimeKillSwitches)
      .where(
        and(
          eq(runtimeKillSwitches.workspaceId, opts.workspaceId),
          eq(runtimeKillSwitches.active, true),
        ),
      ),
  ]);

  const durableActive = (scopeType: string, scopeId?: string | number) =>
    scopeId != null &&
    durableSwitches.some(
      (item) => item.scopeType === scopeType && item.scopeId === String(scopeId),
    );

  const state = {
    ...cachedState,
    workspaceDisabled:
      cachedState.workspaceDisabled || durableActive("workspace", opts.workspaceId),
    identityDisabled: cachedState.identityDisabled || durableActive("identity", opts.identityId),
    projectDisabled: cachedState.projectDisabled || durableActive("project", opts.projectId),
    agentDisabled: cachedState.agentDisabled || durableActive("agent", opts.agentId),
  };

  let budgetBlocked = false;
  let budgetReason: string | null = null;
  let enforcementMode: string | null = null;

  const budgets = await database
    .select()
    .from(teamAiBudgets)
    .where(eq(teamAiBudgets.workspaceId, opts.workspaceId));
  const identityBudget = opts.identityId
    ? budgets.find((b) => b.identityId === opts.identityId)
    : undefined;
  const workspaceBudget = budgets.find((b) => b.identityId == null);
  const applicable = identityBudget ?? workspaceBudget;
  if (applicable) {
    enforcementMode = applicable.enforcementMode;
    const limit = toNumber(applicable.limitUsd);
    const spend = toNumber(applicable.currentSpendUsd);
    const next = spend + (opts.estimatedCostUsd ?? 0);
    if (applicable.hardLimit && applicable.enforcementMode === "gateway" && next > limit) {
      budgetBlocked = true;
      budgetReason = "identity/workspace gateway budget would be exceeded";
    } else if (applicable.hardLimit && applicable.enforcementMode === "monitor_only") {
      // Honesty: never claim block
      budgetBlocked = false;
      budgetReason = "monitor_only budget exceeded threshold (alert only — not blocked by RakshEx)";
    }
  }

  const killActive =
    state.workspaceDisabled ||
    state.identityDisabled ||
    state.projectDisabled ||
    state.agentDisabled;

  return {
    allowed: !killActive && !budgetBlocked,
    killActive,
    budgetBlocked,
    budgetReason,
    enforcementMode,
    state,
    honesty:
      "Hard blocks apply to RakshEx gateway traffic only. Provider-native limits depend on admin API success. monitor_only never claims a RakshEx block.",
  };
}

export interface GatewayBudgetReservation {
  budgetId: number;
  workspaceId: number;
  identityId: number | null;
  reservedUsd: number;
}

/** Soft-threshold state observed at reservation time (WARN tier). */
export interface GatewayBudgetWarning {
  limitUsd: number;
  warningPct: number;
  usedPct: number;
  remainingUsd: number;
}

/**
 * Atomically reserve estimated spend against the applicable hard gateway
 * budget. The conditional UPDATE is the authorization decision: concurrent
 * requests cannot all observe the same remaining budget and overspend it.
 */
export async function reserveGatewayBudget(opts: {
  workspaceId: number;
  identityId?: number;
  estimatedCostUsd: number;
}): Promise<
  | { allowed: true; reservation: GatewayBudgetReservation | null; warning?: GatewayBudgetWarning }
  | { allowed: false; reason: string }
> {
  const database = await db.getDb();
  if (!database) {
    throw new Error("Governance database unavailable — budget reservation is fail-closed");
  }
  const amount = Math.max(0, opts.estimatedCostUsd);
  if (amount === 0) return { allowed: true, reservation: null };

  const budgets = await database
    .select()
    .from(teamAiBudgets)
    .where(eq(teamAiBudgets.workspaceId, opts.workspaceId));
  const identityBudget =
    opts.identityId == null
      ? undefined
      : budgets.find((budget) => budget.identityId === opts.identityId);
  const applicable = identityBudget ?? budgets.find((budget) => budget.identityId == null);
  if (!applicable || !applicable.hardLimit || applicable.enforcementMode !== "gateway") {
    return { allowed: true, reservation: null };
  }

  const [reserved] = await database
    .update(teamAiBudgets)
    .set({
      currentSpendUsd: sql`${teamAiBudgets.currentSpendUsd} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teamAiBudgets.id, applicable.id),
        sql`${teamAiBudgets.currentSpendUsd} + ${amount} <= ${teamAiBudgets.limitUsd}`,
      ),
    )
    .returning({ id: teamAiBudgets.id, currentSpendUsd: teamAiBudgets.currentSpendUsd });

  if (!reserved) {
    return {
      allowed: false,
      reason: "identity/workspace gateway budget would be exceeded",
    };
  }

  const limitUsd = toNumber(applicable.limitUsd);
  const spendAfterUsd = toNumber(reserved.currentSpendUsd);
  const warningPct = applicable.warningPct ?? 80;
  const usedPct = limitUsd > 0 ? (spendAfterUsd / limitUsd) * 100 : 100;
  const warning: GatewayBudgetWarning | undefined =
    usedPct >= warningPct
      ? {
          limitUsd,
          warningPct,
          usedPct: Math.round(usedPct * 100) / 100,
          remainingUsd: Math.max(0, Math.round((limitUsd - spendAfterUsd) * 10_000) / 10_000),
        }
      : undefined;

  return {
    allowed: true,
    reservation: {
      budgetId: applicable.id,
      workspaceId: opts.workspaceId,
      identityId: applicable.identityId,
      reservedUsd: amount,
    },
    ...(warning ? { warning } : {}),
  };
}

/**
 * Settle a reservation to actual cost. `actualCostUsd=0` releases it after an
 * upstream failure. A crash may leave a conservative reservation, which
 * `refreshBudgetSpend` reconciles from idempotent usage events.
 */
export async function settleGatewayBudget(
  reservation: GatewayBudgetReservation | null,
  actualCostUsd: number,
): Promise<void> {
  if (!reservation) return;
  const database = await db.getDb();
  if (!database) {
    throw new Error("Governance database unavailable — budget settlement failed");
  }
  const delta = Math.max(0, actualCostUsd) - reservation.reservedUsd;
  await database
    .update(teamAiBudgets)
    .set({
      currentSpendUsd: sql`GREATEST(0, ${teamAiBudgets.currentSpendUsd} + ${delta})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teamAiBudgets.id, reservation.budgetId),
        eq(teamAiBudgets.workspaceId, reservation.workspaceId),
      ),
    );
}

export async function governanceSummary(workspaceId: number) {
  const database = await db.getDb();
  if (!database) {
    return {
      members: 0,
      identities: 0,
      subscriptions: 0,
      monthlySpendUsd: 0,
      budgetRisk: "unknown" as const,
      shadowFindings: 0,
      providerHealth: [],
    };
  }
  const members = await db.listWorkspaceMembers(workspaceId);
  const identities = await listIdentities(workspaceId);
  const subs = await database
    .select({ id: aiSubscriptions.id })
    .from(aiSubscriptions)
    .where(eq(aiSubscriptions.workspaceId, workspaceId));
  const usage = await usageSummary(workspaceId);
  const budgets = await listBudgets(workspaceId);
  const health = await healthStatus(workspaceId);
  const risk = budgets.some((b) => b.status === "exceeded")
    ? "exceeded"
    : budgets.some((b) => b.status === "warning")
      ? "warning"
      : "ok";

  return {
    members: members.filter((m) => m.active).length,
    identities: identities.length,
    subscriptions: subs.length,
    monthlySpendUsd: usage.totalCostUsd,
    budgetRisk: risk,
    shadowFindings: health.findingsOpen,
    providerHealth: health.providers,
  };
}

/** Pure helpers exported for unit tests */
export const __test = {
  budgetStatus,
  periodStartMonthly,
  validateHardLimitMode(hardLimit: boolean, mode: string) {
    return !(hardLimit && mode === "monitor_only");
  },
};
