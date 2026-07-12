"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "./StatusBadge";
import { EmptyState, ErrorState, PageLoading } from "./States";
import { MetricCard } from "./MetricCard";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function AzureConnectionsTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const utils = trpc.useUtils();
  const {
    data: connections,
    isLoading,
    error,
    refetch,
  } = trpc.enterprise.azure.list.useQuery({ workspaceId });
  const triggerDiscovery = trpc.enterprise.discovery.triggerFullDiscovery.useMutation();
  const testConn = trpc.enterprise.azure.test.useMutation();
  const createConn = trpc.enterprise.azure.create.useMutation();
  const deleteConn = trpc.enterprise.azure.delete.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tenantId: "",
    subscriptionId: "",
    displayName: "",
    clientId: "",
    clientSecret: "",
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const handleConnect = async () => {
    setErrorMsg(null);
    setTestResult(null);
    try {
      const result = await testConn.mutateAsync({
        tenantId: form.tenantId,
        subscriptionId: form.subscriptionId,
      });
      setTestResult(result);
      if (!result.ok) return;
      await createConn.mutateAsync({ workspaceId: workspaceId, ...form });
      setShowForm(false);
      setForm({
        tenantId: "",
        subscriptionId: "",
        displayName: "",
        clientId: "",
        clientSecret: "",
      });
      utils.enterprise.azure.list.invalidate();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const handleDelete = async (id: number) => {
    await deleteConn.mutateAsync({ workspaceId: workspaceId, id });
    utils.enterprise.azure.list.invalidate();
  };

  const handleRunDiscovery = async () => {
    await triggerDiscovery.mutateAsync({ workspaceId: workspaceId });
    utils.enterprise.discovery.listRuns.invalidate();
    utils.enterprise.discovery.getKeyStats.invalidate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Azure Subscriptions</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Connect your Azure subscriptions to discover keys, service principals, and API
            Management resources.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunDiscovery}
            disabled={triggerDiscovery.isPending || !connections?.length}
            className="px-4 py-2 bg-[#14b8a6] hover:bg-[#0d9488] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">radar</span>
            {triggerDiscovery.isPending ? "Scanning..." : "Run Discovery"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Connect
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Connect Form */}
      {showForm && (
        <div className="glass-card rounded-xl p-6 border border-[#14b8a6]/20 space-y-4">
          <h3 className="text-base font-semibold text-white">Connect Azure Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Tenant ID</label>
              <input
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">
                Subscription ID
              </label>
              <input
                value={form.subscriptionId}
                onChange={(e) => setForm({ ...form, subscriptionId: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Display Name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="Production Azure"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Client ID</label>
              <input
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="Service principal client ID"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 font-medium block mb-1">Client Secret</label>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] outline-none"
                placeholder="Service principal client secret"
              />
            </div>
          </div>
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${testResult.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}
            >
              {testResult.ok
                ? "✅ Connection successful! Ready to connect."
                : `❌ ${testResult.error}`}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={createConn.isPending || !form.tenantId || !form.subscriptionId}
              className="px-5 py-2 bg-[#14b8a6] hover:bg-[#0d9488] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {createConn.isPending ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Connection list */}
      {connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="glass-card rounded-xl p-5 border border-[#14b8a6]/20 flex items-center justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-400 text-xl">cloud</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {c.displayName ?? `Azure ${c.subscriptionId.slice(0, 8)}`}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5 font-mono">{c.subscriptionId}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Tenant: <span className="font-mono">{c.tenantId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={c.isActive ? "active" : "disabled"} />
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="cloud_off"
          title="No Azure connections"
          description="Connect your Azure subscription to start discovering API keys, service principals, and secrets across your infrastructure."
          action={{ label: "Connect Azure", onClick: () => setShowForm(true) }}
        />
      )}
    </div>
  );
}
