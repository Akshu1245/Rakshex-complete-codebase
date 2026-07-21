"use client";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "./StatusBadge";
import { MetricCard } from "./MetricCard";
import { PageLoading, ErrorState, EmptyState } from "./States";
import { useEnterpriseWorkspace } from "./WorkspaceContext";
import { SocTwoEvidencePanel } from "@/components/SocTwoEvidencePanel";

export function ComplianceTab() {
  const { workspaceId } = useEnterpriseWorkspace();
  const utils = trpc.useUtils();
  const controls = trpc.enterprise.compliance.listIso27001Controls.useQuery({ workspaceId });
  const summary = trpc.enterprise.compliance.getIso27001Summary.useQuery({ workspaceId });
  const assess = trpc.enterprise.compliance.assessIso27001.useMutation();

  if (controls.isLoading) return <PageLoading />;
  if (controls.error)
    return <ErrorState message={controls.error.message} onRetry={() => controls.refetch()} />;

  const handleAssess = async () => {
    await assess.mutateAsync({ workspaceId: workspaceId });
    utils.enterprise.compliance.listIso27001Controls.invalidate();
    utils.enterprise.compliance.getIso27001Summary.invalidate();
  };

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">ISO27001:2022 Compliance</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            18 Annex A controls auto-assessed from your security posture
          </p>
        </div>
        <button
          onClick={handleAssess}
          disabled={assess.isPending}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">fact_check</span>
          {assess.isPending ? "Assessing..." : "Run Assessment"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Overall Score"
          value={s?.overallScore ? `${s.overallScore}/5.0` : "—"}
          icon="score"
          color={s && s.overallScore >= 4 ? "green" : s && s.overallScore >= 2 ? "yellow" : "gray"}
        />
        <MetricCard
          title="Compliant"
          value={s?.compliant ?? 0}
          icon="check_circle"
          color="green"
          subtitle={`of ${controls.data?.length ?? 0} controls assessed`}
        />
        <MetricCard title="Partial" value={s?.partial ?? 0} icon="warning" color="yellow" />
        <MetricCard title="Non-Compliant" value={s?.nonCompliant ?? 0} icon="cancel" color="red" />
        <MetricCard
          title="Not Assessed"
          value={s?.notAssessed ?? 0}
          icon="help_outline"
          color="gray"
        />
      </div>

      {controls.data && controls.data.length > 0 ? (
        <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
          <h3 className="text-sm font-semibold text-white mb-4">Control Assessments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Control
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Name
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {controls.data.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-[#14b8a6]">{c.controlId}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-gray-300 text-xs">{c.controlName}</span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-mono text-xs font-medium ${Number(c.score ?? 0) >= 4 ? "text-emerald-400" : Number(c.score ?? 0) >= 2 ? "text-yellow-400" : "text-red-400"}`}
                      >
                        {c.score ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="verified"
          title="No assessments yet"
          description="Click Run Assessment to evaluate your security posture against all 18 ISO27001:2022 Annex A controls."
          action={{ label: "Run Assessment", onClick: handleAssess }}
        />
      )}

      <div className="glass-card rounded-xl p-5 border border-[#14b8a6]/20">
        <SocTwoEvidencePanel compact />
      </div>
    </div>
  );
}
