"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "./DataTable";
import { StatusBadge } from "./StatusBadge";
import { MetricCard } from "./MetricCard";
import { PageLoading, ErrorState, EmptyState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function SecurityRisksTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const utils = trpc.useUtils();
  const risks = trpc.enterprise.overprivileged.list.useQuery({ workspaceId });
  const shadow = trpc.enterprise.shadowKeys.list.useQuery({ workspaceId });
  const analyze = trpc.enterprise.discovery.triggerRiskAnalysis.useMutation();
  const acknowledge = trpc.enterprise.overprivileged.acknowledge.useMutation();

  const [activeTab, setActiveTab] = useState<"overprivileged" | "shadow">("overprivileged");

  if (risks.isLoading) return <PageLoading />;
  if (risks.error)
    return <ErrorState message={risks.error.message} onRetry={() => risks.refetch()} />;

  const handleAcknowledge = async (id: number) => {
    await acknowledge.mutateAsync({ id });
    utils.enterprise.overprivileged.list.invalidate();
  };

  const handleAnalyze = async () => {
    await analyze.mutateAsync({ workspaceId });
    utils.enterprise.overprivileged.list.invalidate();
    utils.enterprise.shadowKeys.list.invalidate();
  };

  const riskColumns = [
    {
      key: "severity",
      header: "Severity",
      render: (r: (typeof risks.data)[0]) => <StatusBadge status={r.severity} />,
      sortable: true,
    },
    {
      key: "title",
      header: "Finding",
      render: (r: (typeof risks.data)[0]) => (
        <div>
          <p className="text-white text-xs font-medium">{r.title}</p>
          <p className="text-gray-500 text-xs mt-0.5">{r.description?.slice(0, 80)}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r: (typeof risks.data)[0]) => (
        <span className="text-gray-400 text-xs">{r.category.replace(/_/g, " ")}</span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      render: (r: (typeof risks.data)[0]) => <StatusBadge status={r.status} />,
      sortable: true,
    },
    {
      key: "actions",
      header: "",
      render: (r: (typeof risks.data)[0]) =>
        r.status === "open" ? (
          <button
            onClick={() => handleAcknowledge(r.id)}
            className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-all"
          >
            Acknowledge
          </button>
        ) : null,
      className: "text-right",
    },
  ];

  const shadowColumns = [
    {
      key: "provider",
      header: "Provider",
      render: (s: (typeof shadow.data)[0]) => <StatusBadge status={s.provider} />,
      sortable: true,
    },
    {
      key: "keyPrefix",
      header: "Key",
      render: (s: (typeof shadow.data)[0]) => (
        <span className="text-white font-mono text-xs">{s.keyPrefix}...</span>
      ),
    },
    {
      key: "discoveredIn",
      header: "Found In",
      render: (s: (typeof shadow.data)[0]) => (
        <span className="text-gray-400 text-xs">{s.discoveredIn ?? "—"}</span>
      ),
    },
    {
      key: "riskLevel",
      header: "Risk",
      render: (s: (typeof shadow.data)[0]) => <StatusBadge status={s.riskLevel} />,
      sortable: true,
    },
    {
      key: "isInVault",
      header: "In Vault",
      render: (s: (typeof shadow.data)[0]) => (
        <span className={s.isInVault ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
          {s.isInVault ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Discovered",
      render: (s: (typeof shadow.data)[0]) => (
        <span className="text-gray-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</span>
      ),
      sortable: true,
      sortValue: (s: (typeof shadow.data)[0]) => new Date(s.createdAt).getTime(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("overprivileged")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "overprivileged" ? "bg-[#14b8a6]/15 text-[#14b8a6] border border-[#14b8a6]/30" : "text-gray-400 hover:text-white border border-transparent"}`}
          >
            Over-Privileged Keys ({risks.data?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("shadow")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "shadow" ? "bg-[#14b8a6]/15 text-[#14b8a6] border border-[#14b8a6]/30" : "text-gray-400 hover:text-white border border-transparent"}`}
          >
            Shadow Keys ({shadow.data?.length ?? 0})
          </button>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">analytics</span>
          {analyze.isPending ? "Analyzing..." : "Run Security Analysis"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Critical Risks"
          value={risks.data?.filter((r) => r.severity === "critical").length ?? 0}
          icon="gpp_bad"
          color="red"
        />
        <MetricCard
          title="Open Findings"
          value={risks.data?.filter((r) => r.status === "open").length ?? 0}
          icon="pending_actions"
          color="yellow"
        />
        <MetricCard
          title="Shadow Keys"
          value={shadow.data?.length ?? 0}
          icon="visibility_off"
          color="orange"
        />
      </div>

      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        {activeTab === "overprivileged" ? (
          risks.data && risks.data.length > 0 ? (
            <DataTable
              columns={riskColumns}
              data={risks.data}
              searchable
              searchKeys={["title"]}
              searchPlaceholder="Search findings..."
              pageSize={50}
              maxHeight="500px"
            />
          ) : (
            <EmptyState
              icon="verified"
              title="No over-privileged keys"
              description="Run a security analysis to check for wildcard permissions, broad roles, and excessive scopes."
              action={{ label: "Run Analysis", onClick: handleAnalyze }}
            />
          )
        ) : shadow.data && shadow.data.length > 0 ? (
          <DataTable
            columns={shadowColumns}
            data={shadow.data}
            searchable
            searchKeys={["provider", "discoveredIn"]}
            searchPlaceholder="Search shadow keys..."
            pageSize={50}
            maxHeight="500px"
          />
        ) : (
          <EmptyState
            icon="visibility"
            title="No shadow keys"
            description="Run a security analysis to cross-reference keys in your code against those in your vaults."
            action={{ label: "Run Analysis", onClick: handleAnalyze }}
          />
        )}
      </div>
    </div>
  );
}
