"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "./StatusBadge";
import { DataTable } from "./DataTable";
import { MetricCard } from "./MetricCard";
import { PageLoading, ErrorState, EmptyState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function AgentGuardTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const utils = trpc.useUtils();
  const policies = trpc.enterprise.agentGuard.listPolicies.useQuery({ workspaceId });
  const events = trpc.enterprise.agentGuard.listEvents.useQuery({ workspaceId });
  const createPolicy = trpc.enterprise.agentGuard.createPolicy.useMutation();
  const togglePolicy = trpc.enterprise.agentGuard.togglePolicy.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    action: "alert_only" as const,
    triggers: [{ event: "leak_detected", severity: "high" }],
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (policies.isLoading) return <PageLoading />;
  if (policies.error)
    return <ErrorState message={policies.error.message} onRetry={() => policies.refetch()} />;

  const handleCreate = async () => {
    setErrorMsg(null);
    if (!form.name) {
      setErrorMsg("Policy name is required");
      return;
    }
    try {
      await createPolicy.mutateAsync({
        workspaceId: workspaceId,
        ...form,
        description: `${form.action} policy for ${form.triggers.map((t) => t.event).join(", ")}`,
      });
      setShowForm(false);
      setForm({
        name: "",
        action: "alert_only",
        triggers: [{ event: "leak_detected", severity: "high" }],
      });
      utils.enterprise.agentGuard.listPolicies.invalidate();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to create policy");
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    await togglePolicy.mutateAsync({ id, enabled });
    utils.enterprise.agentGuard.listPolicies.invalidate();
  };

  const policyColumns = [
    {
      key: "name",
      header: "Name",
      render: (p: (typeof policies.data)[0]) => (
        <span className="text-white text-xs font-medium">{p.name}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (p: (typeof policies.data)[0]) => <StatusBadge status={p.action} />,
      sortable: true,
    },
    {
      key: "triggers",
      header: "Triggers",
      render: (p: (typeof policies.data)[0]) => {
        const t = p.triggers as Array<{ event: string; severity: string }> | undefined;
        return (
          <div className="flex gap-1 flex-wrap">
            {t?.map((tr, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-white/5 rounded text-gray-400">
                {tr.event}({tr.severity})
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "isEnabled",
      header: "Status",
      render: (p: (typeof policies.data)[0]) => (
        <StatusBadge status={p.isEnabled ? "active" : "disabled"} />
      ),
      sortable: true,
    },
    {
      key: "actions",
      header: "",
      render: (p: (typeof policies.data)[0]) => (
        <button
          onClick={() => handleToggle(p.id, !p.isEnabled)}
          className={`px-3 py-1 text-xs rounded-lg border transition-all ${p.isEnabled ? "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"}`}
        >
          {p.isEnabled ? "Disable" : "Enable"}
        </button>
      ),
      className: "text-right",
    },
  ];

  const eventColumns = [
    {
      key: "trigger",
      header: "Trigger",
      render: (e: (typeof events.data)[0]) => <StatusBadge status={e.trigger} />,
    },
    {
      key: "action",
      header: "Action",
      render: (e: (typeof events.data)[0]) => <StatusBadge status={e.action} />,
    },
    {
      key: "targetKeyName",
      header: "Target",
      render: (e: (typeof events.data)[0]) => (
        <span className="text-gray-300 text-xs">{e.targetKeyName ?? "—"}</span>
      ),
    },
    {
      key: "result",
      header: "Result",
      render: (e: (typeof events.data)[0]) => (
        <StatusBadge status={e.result ?? "pending"} pulse={!e.result} />
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (e: (typeof events.data)[0]) => <StatusBadge status={e.severity} />,
    },
    {
      key: "executedAt",
      header: "Time",
      render: (e: (typeof events.data)[0]) => (
        <span className="text-gray-500 text-xs">{new Date(e.executedAt).toLocaleString()}</span>
      ),
      sortable: true,
      sortValue: (e: (typeof events.data)[0]) => new Date(e.executedAt).getTime(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">AgentGuard Policies</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#14b8a6] hover:bg-[#0d9488] text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create Policy
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {showForm && (
        <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20 space-y-4">
          <h3 className="text-sm font-semibold text-white">New AgentGuard Policy</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Policy Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="Auto-revoke leaked keys"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as "alert_only" })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#14b8a6] outline-none"
              >
                <option value="alert_only">Alert Only</option>
                <option value="revoke">Revoke Key</option>
                <option value="rotate">Rotate Secret</option>
                <option value="disable">Disable Key</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            {["leak_detected", "overprivileged", "expired_key", "shadow_key"].map((event) => (
              <label
                key={event}
                className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.triggers.some((t) => t.event === event)}
                  onChange={() =>
                    setForm({
                      ...form,
                      triggers: form.triggers.some((t) => t.event === event)
                        ? form.triggers.filter((t) => t.event !== event)
                        : [...form.triggers, { event, severity: "high" }],
                    })
                  }
                  className="accent-[#14b8a6]"
                />
                {event.replace(/_/g, " ")}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createPolicy.isPending}
              className="px-5 py-2 bg-[#14b8a6] hover:bg-[#0d9488] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {createPolicy.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {policies.data && policies.data.length > 0 ? (
        <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
          <DataTable
            columns={policyColumns}
            data={policies.data}
            emptyTitle="No policies"
            emptyDescription="Create your first AgentGuard policy to enable autonomous key protection."
            pageSize={50}
          />
        </div>
      ) : (
        <EmptyState
          icon="security"
          title="No AgentGuard policies"
          description="Create autonomous policies that automatically revoke, rotate, or alert when high-risk keys are detected."
          action={{ label: "Create Policy", onClick: () => setShowForm(true) }}
        />
      )}

      <h2 className="text-lg font-semibold text-white mt-8">Event History</h2>
      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        {events.data && events.data.length > 0 ? (
          <DataTable
            columns={eventColumns}
            data={events.data}
            searchable
            searchKeys={["targetKeyName", "reason"]}
            searchPlaceholder="Search events..."
            pageSize={50}
            maxHeight="400px"
          />
        ) : (
          <EmptyState
            icon="history"
            title="No events yet"
            description="AgentGuard events will appear here when policies trigger."
          />
        )}
      </div>
    </div>
  );
}
