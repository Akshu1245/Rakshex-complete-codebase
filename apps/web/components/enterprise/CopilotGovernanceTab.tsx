"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { DataTable } from "./DataTable";
import { PageLoading, ErrorState, EmptyState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function CopilotGovernanceTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = trpc.enterprise.copilot.getMetrics.useQuery({ workspaceId });
  const sync = trpc.enterprise.copilot.sync.useMutation();
  const [orgName, setOrgName] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleSync = async () => {
    if (!orgName) return;
    setSyncMsg(null);
    try {
      await sync.mutateAsync({ workspaceId, orgName });
      setSyncMsg("✅ Synced successfully");
      refetch();
    } catch (e) {
      setSyncMsg(`❌ ${e instanceof Error ? e.message : "Sync failed"}`);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const seats = metrics?.seatDetails ?? [];

  return (
    <div className="space-y-6">
      {/* Sync bar */}
      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        <h3 className="text-sm font-semibold text-white mb-3">Sync Copilot Metrics</h3>
        <div className="flex items-center gap-3">
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="GitHub organization name (e.g., my-org)"
            className="flex-1 bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
          />
          <button
            onClick={handleSync}
            disabled={sync.isPending || !orgName}
            className="px-5 py-2.5 bg-[#14b8a6] hover:bg-[#0d9488] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all whitespace-nowrap"
          >
            {sync.isPending ? "Syncing..." : "Sync Now"}
          </button>
        </div>
        {syncMsg && <p className="text-xs mt-2 text-gray-400">{syncMsg}</p>}
        {!process.env.GITHUB_COPILOT_TOKEN && (
          <p className="text-xs mt-2 text-yellow-400">
            ⚠️ Set GITHUB_COPILOT_TOKEN env var for real data
          </p>
        )}
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Seats"
          value={metrics?.totalSeats ?? "—"}
          icon="group"
          color="blue"
          subtitle="Licensed seats"
        />
        <MetricCard
          title="Active Users"
          value={metrics?.activeSeats ?? "—"}
          icon="person"
          color="green"
          subtitle="Using Copilot this month"
        />
        <MetricCard
          title="Est. Monthly Cost"
          value={metrics?.totalUsageUsd ? `$${metrics.totalUsageUsd}` : "—"}
          icon="payments"
          color="yellow"
          subtitle="$19/user/month"
        />
        <MetricCard
          title="Last Synced"
          value={metrics?.lastSynced ? new Date(metrics.lastSynced).toLocaleDateString() : "—"}
          icon="sync"
          color="gray"
          subtitle="Latest metric refresh"
        />
      </div>

      {/* Seat details */}
      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        <h3 className="text-sm font-semibold text-white mb-4">Seat Assignments</h3>
        {seats.length > 0 ? (
          <DataTable
            columns={[
              {
                key: "login",
                header: "User",
                render: (s: (typeof seats)[0]) => (
                  <span className="text-white text-xs font-medium">{s.login}</span>
                ),
                sortable: true,
              },
              {
                key: "planType",
                header: "Plan",
                render: (s: (typeof seats)[0]) => <StatusBadge status={s.planType} />,
                sortable: true,
              },
              {
                key: "lastActivity",
                header: "Last Activity",
                render: (s: (typeof seats)[0]) => (
                  <span className="text-gray-500 text-xs">
                    {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "Never"}
                  </span>
                ),
                sortable: true,
                sortValue: (s: (typeof seats)[0]) =>
                  s.lastActivity ? new Date(s.lastActivity).getTime() : 0,
              },
            ]}
            data={seats}
            searchable
            searchKeys={["login"]}
            searchPlaceholder="Search users..."
            emptyTitle="No seat data"
            emptyDescription="Sync Copilot metrics to see seat assignments."
          />
        ) : (
          <EmptyState
            icon="smart_toy"
            title="No Copilot data"
            description="Enter your GitHub org name and click Sync to fetch seat assignments and usage metrics."
          />
        )}
      </div>
    </div>
  );
}
