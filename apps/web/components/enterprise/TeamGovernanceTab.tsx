"use client";

import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useEnterpriseWorkspace } from "./WorkspaceContext";
import { MetricCard } from "./MetricCard";
import { DataTable } from "./DataTable";
import { StatusBadge } from "./StatusBadge";

type PoolMetadata = {
  enabled?: boolean;
  mode?: "shareable" | "pooled" | "locked";
  maxBorrowUsd?: number;
  approvalThresholdUsd?: number;
  emergencyReserveUsd?: number;
};

function readPoolMetadata(metadata: unknown): PoolMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  const pool = (metadata as Record<string, unknown>).pool;
  if (!pool || typeof pool !== "object") return {};
  return pool as PoolMetadata;
}

type IdentityRow = {
  id: number;
  displayName: string;
  provider: string;
  email: string;
  status: string;
};

export function TeamGovernanceTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const [budgetLimit, setBudgetLimit] = useState("500");
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [maxBorrowUsd, setMaxBorrowUsd] = useState("25");
  const [emergencyReserveUsd, setEmergencyReserveUsd] = useState("0");
  const [approvalThresholdUsd, setApprovalThresholdUsd] = useState("20");
  const [enforcementMode, setEnforcementMode] = useState<"gateway" | "monitor_only">("gateway");
  const [orgName, setOrgName] = useState("");

  const summary = trpc.teamGovernance.summary.useQuery({ workspaceId });
  const entitlements = trpc.teamGovernance.entitlements.useQuery({ workspaceId });
  const identities = trpc.teamGovernance.listIdentities.useQuery({ workspaceId });
  const usage = trpc.teamGovernance.usageSummary.useQuery({ workspaceId });
  const budgets = trpc.teamGovernance.listBudgets.useQuery({ workspaceId });
  const killSwitches = trpc.teamGovernance.listKillSwitches.useQuery({ workspaceId });
  const connectors = trpc.teamGovernance.listConnectors.useQuery({ workspaceId });
  const health = trpc.teamGovernance.providerHealth.useQuery({ workspaceId });

  const setBudget = trpc.teamGovernance.setBudget.useMutation({
    onSuccess: () => budgets.refetch(),
  });

  const workspaceBudget = budgets.data?.find((b) => b.identityId == null);

  useEffect(() => {
    if (!workspaceBudget) return;
    setBudgetLimit(String(workspaceBudget.limitUsd));
    setEnforcementMode(
      workspaceBudget.enforcementMode === "monitor_only" ? "monitor_only" : "gateway",
    );
    const pool = readPoolMetadata(workspaceBudget.metadata);
    setPoolEnabled(pool.enabled === true);
    if (typeof pool.maxBorrowUsd === "number") setMaxBorrowUsd(String(pool.maxBorrowUsd));
    if (typeof pool.emergencyReserveUsd === "number") {
      setEmergencyReserveUsd(String(pool.emergencyReserveUsd));
    }
    if (typeof pool.approvalThresholdUsd === "number") {
      setApprovalThresholdUsd(String(pool.approvalThresholdUsd));
    }
  }, [workspaceBudget]);
  const setKillSwitch = trpc.teamGovernance.setKillSwitch.useMutation({
    onSuccess: () => killSwitches.refetch(),
  });
  const syncProvider = trpc.teamGovernance.syncProvider.useMutation({
    onSuccess: () => {
      identities.refetch();
      usage.refetch();
      health.refetch();
    },
  });

  const toggleWorkspaceKill = useCallback(async () => {
    const active = !killSwitches.data?.some(
      (k) => k.scopeType === "workspace" && k.scopeId === String(workspaceId) && k.active,
    );
    await setKillSwitch.mutateAsync({
      workspaceId,
      scopeType: "workspace",
      scopeId: String(workspaceId),
      active,
      reason: active ? "Manual workspace kill switch" : "Kill switch cleared",
    });
  }, [killSwitches.data, setKillSwitch, workspaceId]);

  const seats = entitlements.data?.seats;
  const identityRows: IdentityRow[] = (identities.data ?? []).map((i) => ({
    id: i.id,
    displayName: i.displayName ?? i.externalUserId,
    provider: i.provider,
    email: i.email ?? "—",
    status: i.status,
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Seats used"
          value={seats ? `${seats.used}/${seats.limit}` : "—"}
          subtitle="Members + pending invites"
        />
        <MetricCard
          title="AI identities"
          value={String(summary.data?.identities ?? 0)}
          subtitle="Synced provider seats"
        />
        <MetricCard
          title="Monthly spend"
          value={`$${(summary.data?.monthlySpendUsd ?? 0).toFixed(2)}`}
          subtitle="Attributed usage"
        />
        <MetricCard
          title="Kill switches"
          value={String(killSwitches.data?.filter((k) => k.active).length ?? 0)}
          subtitle="Gateway blocks routed traffic only"
          color="red"
        />
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Team members & provider seats</h2>
            <p className="text-sm text-gray-500">
              Employees never receive provider API keys. Connect admin subscriptions to sync seats
              and usage.
            </p>
          </div>
          <div className="flex gap-2 items-end">
            <label className="text-sm text-gray-400">
              GitHub org
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="your-org"
                className="mt-1 block px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                syncProvider.mutate({
                  workspaceId,
                  provider: "github_copilot",
                  orgName: orgName || undefined,
                })
              }
              disabled={syncProvider.isPending}
              className="px-4 py-2 rounded-lg bg-[#14b8a6] text-black text-sm font-medium disabled:opacity-50"
            >
              {syncProvider.isPending ? "Syncing…" : "Sync Copilot"}
            </button>
          </div>
        </div>
        <DataTable<IdentityRow>
          columns={[
            {
              key: "displayName",
              header: "Employee",
              render: (row) => <span className="text-white text-xs">{row.displayName}</span>,
            },
            {
              key: "provider",
              header: "Provider",
              render: (row) => <span className="text-gray-400 text-xs">{row.provider}</span>,
            },
            {
              key: "email",
              header: "Email",
              render: (row) => <span className="text-gray-400 text-xs">{row.email}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
          data={identityRows}
          emptyTitle="No identities synced"
          emptyDescription="Connect GitHub Copilot, OpenAI Team, or import CSV seats."
        />
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Budgets & per-employee limits</h2>
        <p className="text-sm text-gray-500">
          Hard limits apply only to traffic routed through the RaksHex gateway. Imported provider
          usage is monitoring-only.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-gray-400">
            Monthly limit (USD)
            <input
              type="number"
              min={1}
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="mt-1 block w-32 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
            />
          </label>
          <label className="text-sm text-gray-400">
            Enforcement
            <select
              value={enforcementMode}
              onChange={(e) => setEnforcementMode(e.target.value as "gateway" | "monitor_only")}
              className="mt-1 block px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
            >
              <option value="gateway">Gateway hard limit</option>
              <option value="monitor_only">Monitor only (alerts)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={setBudget.isPending}
            onClick={() => {
              const limitUsd = Number(budgetLimit);
              const pool = poolEnabled
                ? {
                    enabled: true,
                    mode: "shareable" as const,
                    maxBorrowUsd: Number(maxBorrowUsd) || 25,
                    approvalThresholdUsd: Number(approvalThresholdUsd) || 20,
                    emergencyMinPriority: "critical" as const,
                    emergencyReserveUsd: Number(emergencyReserveUsd) || 0,
                  }
                : { enabled: false };
              setBudget.mutate({
                workspaceId,
                limitUsd,
                hardLimit: enforcementMode === "gateway",
                enforcementMode,
                metadata: { pool },
              });
            }}
            className="px-4 py-2 rounded-lg border border-[#14b8a6]/40 text-[#14b8a6] text-sm disabled:opacity-50"
          >
            {setBudget.isPending ? "Saving…" : "Save workspace budget"}
          </button>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-white">Dynamic team AI pool</h3>
              <p className="text-xs text-gray-500 mt-1">
                Lets identities borrow unused gateway budget from teammates when their personal
                limit is exhausted. Requires gateway hard limits.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={poolEnabled}
                onChange={(e) => setPoolEnabled(e.target.checked)}
                disabled={enforcementMode !== "gateway"}
                className="rounded border-white/20"
              />
              Enabled
            </label>
          </div>
          {poolEnabled && enforcementMode === "gateway" && (
            <div className="flex flex-wrap gap-3">
              <label className="text-xs text-gray-400">
                Max borrow (USD)
                <input
                  type="number"
                  min={0}
                  value={maxBorrowUsd}
                  onChange={(e) => setMaxBorrowUsd(e.target.value)}
                  className="mt-1 block w-28 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
                />
              </label>
              <label className="text-xs text-gray-400">
                Approval threshold (USD)
                <input
                  type="number"
                  min={0}
                  value={approvalThresholdUsd}
                  onChange={(e) => setApprovalThresholdUsd(e.target.value)}
                  className="mt-1 block w-28 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
                />
              </label>
              <label className="text-xs text-gray-400">
                Emergency reserve (USD)
                <input
                  type="number"
                  min={0}
                  value={emergencyReserveUsd}
                  onChange={(e) => setEmergencyReserveUsd(e.target.value)}
                  className="mt-1 block w-28 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white"
                />
              </label>
            </div>
          )}
        </div>
        <DataTable<{
          id: number;
          scope: string;
          limitUsd: string;
          spent: string;
          mode: string;
          pool: string;
        }>
          columns={[
            {
              key: "scope",
              header: "Scope",
              render: (row) => <span className="text-white text-xs">{row.scope}</span>,
            },
            {
              key: "limitUsd",
              header: "Limit",
              render: (row) => <span className="text-gray-400 text-xs">{row.limitUsd}</span>,
            },
            {
              key: "spent",
              header: "Spent",
              render: (row) => <span className="text-gray-400 text-xs">{row.spent}</span>,
            },
            {
              key: "mode",
              header: "Enforcement",
              render: (row) => <span className="text-gray-500 text-xs">{row.mode}</span>,
            },
            {
              key: "pool",
              header: "Pool",
              render: (row) => <span className="text-gray-500 text-xs">{row.pool}</span>,
            },
          ]}
          data={(budgets.data ?? []).map((b) => {
            const pool = readPoolMetadata(b.metadata);
            const meta =
              b.metadata && typeof b.metadata === "object"
                ? (b.metadata as Record<string, unknown>)
                : {};
            const poolLabel =
              b.identityId == null
                ? pool.enabled
                  ? `Borrow up to $${pool.maxBorrowUsd ?? 25}`
                  : "Off"
                : meta.shareable === false
                  ? "Protected"
                  : "Shareable";
            return {
              id: b.id,
              scope: b.identityId ? `Employee #${b.identityId}` : "Workspace",
              limitUsd: `$${b.limitUsd}`,
              spent: `$${b.currentSpendUsd}`,
              mode: String(b.hardLimitHonest ?? b.enforcementMode),
              pool: poolLabel,
            };
          })}
          emptyTitle="No budgets"
          emptyDescription="Set a workspace or per-employee budget."
        />
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Kill switch</h2>
            <p className="text-sm text-gray-500">
              Propagates to Redis for fast gateway rejection. Direct provider traffic may continue
              unless routed through the gateway.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleWorkspaceKill}
            disabled={setKillSwitch.isPending}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm"
          >
            Toggle workspace kill switch
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Provider connectors & health</h2>
        <DataTable<{ id: string; provider: string; seats: string; usage: string; note: string }>
          columns={[
            {
              key: "provider",
              header: "Provider",
              render: (row) => <span className="text-white text-xs">{row.provider}</span>,
            },
            {
              key: "seats",
              header: "Seat sync",
              render: (row) => <span className="text-gray-400 text-xs">{row.seats}</span>,
            },
            {
              key: "usage",
              header: "Usage sync",
              render: (row) => <span className="text-gray-400 text-xs">{row.usage}</span>,
            },
            {
              key: "note",
              header: "Enforcement truth",
              render: (row) => (
                <span className="text-gray-500 text-xs max-w-md block">{row.note}</span>
              ),
            },
          ]}
          data={(connectors.data ?? []).map((c) => ({
            id: c.provider,
            provider: c.provider,
            seats: c.seatSync ? "Yes" : "No",
            usage: c.usageSync ? "Yes" : "No",
            note: c.note,
          }))}
        />
        <DataTable<{
          id: number;
          provider: string;
          status: string;
          stale: string;
          error: string;
          action: string;
        }>
          columns={[
            {
              key: "provider",
              header: "Provider",
              render: (row) => <span className="text-white text-xs">{row.provider}</span>,
            },
            {
              key: "status",
              header: "Sync status",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "stale",
              header: "Stale",
              render: (row) => <span className="text-gray-400 text-xs">{row.stale}</span>,
            },
            {
              key: "error",
              header: "Last error",
              render: (row) => <span className="text-gray-500 text-xs">{row.error}</span>,
            },
            {
              key: "action",
              header: "Action",
              render: (row) => (
                <button
                  type="button"
                  disabled={syncProvider.isPending}
                  onClick={() =>
                    syncProvider.mutate({
                      workspaceId,
                      provider: row.provider,
                      providerAccountId: row.id,
                      orgName: row.provider === "github_copilot" && orgName ? orgName : undefined,
                    })
                  }
                  className="text-xs px-3 py-1.5 rounded border border-white/10 text-[#14b8a6] disabled:opacity-50"
                >
                  Sync now
                </button>
              ),
            },
          ]}
          data={(health.data?.providers ?? []).map((p) => ({
            id: p.accountId,
            provider: p.provider,
            status: p.syncStatus,
            stale: p.stale ? "Yes" : "No",
            error: p.lastSyncError ?? "—",
            action: "sync",
          }))}
          emptyTitle="No provider accounts"
          emptyDescription="Connect a provider in Control Plane to see health."
        />
      </section>
    </div>
  );
}
