"use client";
import { trpc } from "@/lib/trpc";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { LoadingSkeleton, ErrorState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";

export function OverviewTab() {
  const { workspaceId } = useEnterpriseWorkspace();

  const keyStats = trpc.enterprise.discovery.getKeyStats.useQuery({ workspaceId });
  const runs = trpc.enterprise.discovery.listRuns.useQuery({ workspaceId });
  const risks = trpc.enterprise.overprivileged.list.useQuery({ workspaceId });
  const shadow = trpc.enterprise.shadowKeys.list.useQuery({ workspaceId });
  const events = trpc.enterprise.agentGuard.listEvents.useQuery({ workspaceId });
  const copilot = trpc.enterprise.copilot.getMetrics.useQuery({ workspaceId });
  const iso = trpc.enterprise.compliance.getIso27001Summary.useQuery({ workspaceId });

  const loading = keyStats.isLoading || runs.isLoading;
  const error = keyStats.error || runs.error;

  if (error)
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          keyStats.refetch();
          runs.refetch();
        }}
      />
    );

  const s = keyStats.data;
  const riskCount = risks.data?.length ?? 0;
  const shadowCount = shadow.data?.length ?? 0;
  const eventCount = events.data?.length ?? 0;
  const keyHealth = s?.total
    ? Math.round(((s.active - (riskCount > 0 ? 1 : 0)) / s.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 entrance-anim">
        <MetricCard
          title="Total Keys"
          value={s?.total ?? "—"}
          icon="vpn_key"
          color="teal"
          subtitle="Across Azure & GitHub"
        >
          {s && (
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-400">{s.active} active</span>
              <span className="text-red-400">{s.expired} expired</span>
              <span className="text-gray-500">{s.revoked} revoked</span>
            </div>
          )}
        </MetricCard>
        <MetricCard
          title="Key Health"
          value={loading ? "—" : `${keyHealth}%`}
          icon="health_and_safety"
          color={keyHealth >= 80 ? "green" : keyHealth >= 50 ? "yellow" : "red"}
          subtitle="Active / secure keys ratio"
        />
        <MetricCard
          title="Risk Findings"
          value={riskCount + shadowCount}
          icon="gpp_bad"
          color={riskCount + shadowCount > 0 ? "red" : "green"}
          subtitle="Over-privileged + shadow keys"
        />
        <MetricCard
          title="Compliance Score"
          value={iso.data?.overallScore ? `${iso.data.overallScore}/5.0` : "—"}
          icon="verified"
          color={
            iso.data && iso.data.overallScore >= 4
              ? "green"
              : iso.data && iso.data.overallScore >= 2
                ? "yellow"
                : "gray"
          }
          subtitle={`${iso.data?.compliant ?? 0} of 18 ISO27001 controls compliant`}
        />
      </div>

      {/* Secondary Row */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 entrance-anim"
        style={{ animationDelay: "0.1s" }}
      >
        <MetricCard
          title="Copilot Seats"
          value={copilot.data?.totalSeats ?? "—"}
          icon="smart_toy"
          color="purple"
          subtitle={`${copilot.data?.activeSeats ?? 0} active users`}
        />
        <MetricCard
          title="AgentGuard Events"
          value={eventCount}
          icon="security"
          color={eventCount > 0 ? "blue" : "gray"}
          subtitle="Autonomous actions taken"
        />
        <MetricCard
          title="Monthly Spend"
          value={copilot.data?.totalUsageUsd ? `$${copilot.data.totalUsageUsd}` : "—"}
          icon="payments"
          color="yellow"
          subtitle="Estimated Copilot + Azure costs"
        />
      </div>

      {/* Recent Discovery Runs */}
      <div
        className="glass-card rounded-xl p-5 border border-[#14b8a6]/20 entrance-anim"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Recent Discovery Runs</h3>
          <button
            onClick={() => runs.refetch()}
            className="text-gray-500 hover:text-[#14b8a6] transition-colors"
          >
            <span
              className={`material-symbols-outlined text-lg ${runs.isRefetching ? "animate-spin" : ""}`}
            >
              refresh
            </span>
          </button>
        </div>
        {runs.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : runs.data && runs.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2.5 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Run
                  </th>
                  <th className="text-left py-2.5 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-2.5 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Keys Found
                  </th>
                  <th className="text-right py-2.5 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.data.slice(0, 5).map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2.5 px-2 text-gray-300 font-mono text-xs">
                      {r.id.slice(0, 24)}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={r.status} pulse={r.status === "running"} />
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-300 font-mono">
                      {r.keysFound}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-500 text-xs">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No discovery runs yet.{" "}
            <button
              onClick={() => (document.querySelector('[data-tab="azure"]') as HTMLElement)?.click()}
              className="text-[#14b8a6] hover:underline"
            >
              Connect Azure
            </button>{" "}
            and run your first discovery.
          </div>
        )}
      </div>
    </div>
  );
}
