"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "./DataTable";
import { StatusBadge } from "./StatusBadge";
import { MetricCard } from "./MetricCard";
import { PageLoading, ErrorState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function KeyInventoryTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const keyStats = trpc.enterprise.discovery.getKeyStats.useQuery({ workspaceId });
  const keyList = trpc.enterprise.discovery.listDiscoveredKeys.useQuery({ workspaceId });
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  if (keyStats.isLoading) return <PageLoading />;
  if (keyStats.error)
    return <ErrorState message={keyStats.error.message} onRetry={() => keyStats.refetch()} />;

  const s = keyStats.data;
  const keys = keyList.data ?? [];

  const filtered = keys.filter((k) => {
    if (filterType !== "all" && k.resourceType !== filterType) return false;
    if (filterStatus !== "all" && k.status !== filterStatus) return false;
    return true;
  });

  const columns = [
    {
      key: "keyName",
      header: "Name",
      render: (k: (typeof keys)[0]) => (
        <span className="text-white font-medium text-xs">{k.keyName}</span>
      ),
      sortable: true,
      searchable: true,
    },
    {
      key: "resourceType",
      header: "Type",
      render: (k: (typeof keys)[0]) => <StatusBadge status={k.resourceType} />,
      sortable: true,
    },
    {
      key: "resourceName",
      header: "Source",
      render: (k: (typeof keys)[0]) => (
        <span className="text-gray-400 text-xs">
          {k.resourceName?.replace("https://", "").slice(0, 40)}
        </span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      render: (k: (typeof keys)[0]) => (
        <StatusBadge status={k.status} pulse={k.status === "active"} />
      ),
      sortable: true,
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (k: (typeof keys)[0]) => (
        <span className={`text-xs ${k.isExpired ? "text-red-400" : "text-gray-500"}`}>
          {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "—"}
        </span>
      ),
      sortable: true,
      sortValue: (k: (typeof keys)[0]) => (k.expiresAt ? new Date(k.expiresAt).getTime() : 0),
    },
    {
      key: "assignedTo",
      header: "Owner",
      render: (k: (typeof keys)[0]) => (
        <span className="text-gray-400 text-xs">{k.assignedTo ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard title="Total" value={s?.total ?? 0} icon="vpn_key" color="teal" />
        <MetricCard title="Active" value={s?.active ?? 0} icon="check_circle" color="green" />
        <MetricCard title="Expired" value={s?.expired ?? 0} icon="warning" color="red" />
        <MetricCard title="Revoked" value={s?.revoked ?? 0} icon="block" color="gray" />
      </div>

      {/* By type breakdown */}
      {s?.byType && Object.keys(s.byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(s.byType).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "all" : type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterType === type ? "bg-[#14b8a6]/15 border-[#14b8a6]/30 text-[#14b8a6]" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
            >
              {type.replace(/([A-Z])/g, " $1").trim()}{" "}
              <span className="opacity-60">{String(count)}</span>
            </button>
          ))}
          {filterType !== "all" && (
            <button
              onClick={() => setFilterType("all")}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={keyList.isLoading}
          searchable
          searchPlaceholder="Search by key name..."
          searchKeys={["keyName", "resourceName"]}
          emptyTitle="No keys found"
          emptyDescription={
            keyList.data?.length === 0
              ? "Connect Azure and run discovery to see keys."
              : "No keys match your current filters."
          }
          emptyIcon="vpn_key_off"
          pageSize={100}
          maxHeight="500px"
        />
      </div>
    </div>
  );
}
