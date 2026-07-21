"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendPoint {
  date: string;
  overall: number;
  blockedRate: number;
  leakRate: number;
  errorRate: number;
}

export default function RedTeamPage() {
  const [activeTab, setActiveTab] = useState<"trends" | "findings" | "schedule">("trends");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const runsQuery = trpc.runtimeGovernance.redteamRuns.useQuery({ limit: 50 });
  const startRedteam = trpc.runtimeGovernance.startRedteam.useMutation({
    onSuccess: () => {
      utils.runtimeGovernance.redteamRuns.invalidate();
    },
  });

  const runs = runsQuery.data?.runs ?? [];
  const loading = runsQuery.isLoading;

  const trendData: TrendPoint[] = useMemo(() => {
    const completed = [...runs]
      .filter((r) => r.status === "completed" || r.securityScore != null)
      .sort(
        (a, b) =>
          new Date(a.finishedAt ?? a.createdAt).getTime() -
          new Date(b.finishedAt ?? b.createdAt).getTime(),
      );

    return completed.map((r) => {
      const total = Math.max(1, r.totalPayloads ?? 0);
      const date = new Date(r.finishedAt ?? r.createdAt);
      return {
        date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        overall: r.securityScore ?? 0,
        blockedRate: Math.round(((r.blockedCount ?? 0) / total) * 100),
        leakRate: Math.round(((r.leakedCount ?? 0) / total) * 100),
        errorRate: Math.round(((r.erroredCount ?? 0) / total) * 100),
      };
    });
  }, [runs]);

  const latestRunId = useMemo(() => {
    const completed = runs.find((r) => r.status === "completed") ?? runs[0];
    return completed?.id ?? null;
  }, [runs]);

  const activeRunId = selectedRunId ?? latestRunId;
  const activeFindingsQuery = trpc.runtimeGovernance.redteamRun.useQuery(
    { runId: activeRunId! },
    { enabled: Boolean(activeRunId) && activeTab === "findings" },
  );
  const findings = activeFindingsQuery.data?.findings ?? [];

  const runNow = async () => {
    try {
      await startRedteam.mutateAsync({
        target: window.location.origin,
      });
    } catch (err) {
      alert("Run failed: " + (err as Error).message);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical":
      case "Critical":
        return "text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/30";
      case "high":
      case "High":
        return "text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/30";
      case "medium":
      case "Medium":
        return "text-[#FDB022] bg-[#FDB022]/15 border-[#FDB022]/30";
      default:
        return "text-[#94A3B8] bg-black/50/50 border-[#2D3E50]/30";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Red Team</h1>
          <p className="text-gray-400 mt-1">
            Continuous adversarial testing against your AI systems
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={startRedteam.isPending}
          className="px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#EF4444]/90 font-semibold transition-all disabled:opacity-50"
        >
          {startRedteam.isPending ? "Running…" : "Run Now"}
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-black/50/50 rounded-lg p-1 w-fit border border-[#2D3E50]">
        {(["trends", "findings", "schedule"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-[#06D6A0] text-[#0A0E1A]" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "trends" ? "Score Trends" : tab === "findings" ? "Findings" : "Schedule"}
          </button>
        ))}
      </div>

      {activeTab === "trends" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <ScoreCard
                  label="Overall Resilience"
                  score={trendData[trendData.length - 1]?.overall ?? 0}
                  previous={trendData[trendData.length - 2]?.overall ?? 0}
                />
                <ScoreCard
                  label="Block rate %"
                  score={trendData[trendData.length - 1]?.blockedRate ?? 0}
                  previous={trendData[trendData.length - 2]?.blockedRate ?? 0}
                />
                <ScoreCard
                  label="Leak rate %"
                  score={trendData[trendData.length - 1]?.leakRate ?? 0}
                  previous={trendData[trendData.length - 2]?.leakRate ?? 0}
                  invertDelta
                />
                <ScoreCard
                  label="Error rate %"
                  score={trendData[trendData.length - 1]?.errorRate ?? 0}
                  previous={trendData[trendData.length - 2]?.errorRate ?? 0}
                  invertDelta
                />
              </>
            )}
          </div>

          <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Resilience Trend</h2>
            {loading ? (
              <div className="h-80 bg-transparent rounded-lg animate-pulse border border-[#2D3E50]" />
            ) : trendData.length === 0 ? (
              <EmptyState
                compact
                title="No trend data available"
                description="Run your first red-team test to populate security score history."
                actions={[{ label: "Run now", onClick: runNow, variant: "primary" }]}
              />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
                    <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0A0E1A",
                        border: "1px solid #2D3E50",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#E5E7EB" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Overall score"
                      stroke="#06D6A0"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="blockedRate"
                      name="Block %"
                      stroke="#00F0FF"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="leakRate"
                      name="Leak %"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="errorRate"
                      name="Error %"
                      stroke="#FDB022"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {runs.length > 0 && (
            <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Recent runs</h3>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {runs.slice(0, 12).map((r) => (
                  <li
                    key={r.id}
                    className="text-xs text-gray-400 flex justify-between gap-2 border-b border-[#2D3E50]/40 pb-2"
                  >
                    <span className="truncate">
                      {r.target} · {r.status}
                      {r.securityScore != null ? ` · score ${r.securityScore}` : ""}
                    </span>
                    <span className="shrink-0">
                      {new Date(r.finishedAt ?? r.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === "findings" && (
        <div className="space-y-4">
          {runs.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Run</label>
              <select
                className="bg-transparent border border-[#2D3E50] rounded-lg px-3 py-2 text-gray-200 text-sm"
                value={activeRunId ?? ""}
                onChange={(e) => setSelectedRunId(e.target.value || null)}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString()} · {r.status}
                    {r.securityScore != null ? ` · ${r.securityScore}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg overflow-hidden">
            {activeFindingsQuery.isLoading || loading ? (
              <div className="p-6 space-y-4">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : findings.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  compact
                  title="No findings yet"
                  description="Run a red-team test to discover vulnerabilities."
                />
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-transparent text-gray-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium">Sample</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3E50]/30">
                  {findings.map((f) => (
                    <tr key={f.id} className="hover:bg-[#06D6A0]/10 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium border ${severityColor(f.severity)}`}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{f.category}</td>
                      <td className="px-4 py-3 text-gray-300">{f.outcome}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-md truncate font-mono text-xs">
                        {f.sample ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-6">
          <SchedulePanel />
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  previous,
  invertDelta = false,
}: {
  label: string;
  score: number;
  previous: number;
  invertDelta?: boolean;
}) {
  const delta = score - previous;
  const improved = invertDelta ? delta <= 0 : delta >= 0;
  const deltaColor = improved ? "text-[#10B981]" : "text-[#EF4444]";
  const deltaIcon = delta >= 0 ? "↑" : "↓";

  return (
    <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-4">
      <div className="text-gray-400 text-sm">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{score.toFixed(1)}</div>
      <div className={`text-xs mt-1 ${deltaColor}`}>
        {deltaIcon} {Math.abs(delta).toFixed(1)} from last run
      </div>
    </div>
  );
}

function SchedulePanel() {
  const [cron, setCron] = useState("0 2 * * 1");
  const [enabled, setEnabled] = useState(true);
  const schedule = trpc.runtimeGovernance.scheduleRedteam.useMutation();

  const saveSchedule = async () => {
    try {
      await schedule.mutateAsync({
        target: window.location.origin,
        cron,
      });
      alert("Schedule saved");
    } catch (err) {
      alert("Save failed: " + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <label className="text-white font-medium">Auto-run enabled</label>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${enabled ? "bg-[#06D6A0]" : "bg-gray-600 border border-[#2D3E50]"}`}
        >
          <div
            className={`w-5 h-5 rounded-full transition-all ${enabled ? "translate-x-[26px] bg-transparent" : "translate-x-0.5 bg-white"}`}
          />
        </button>
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-2">Cron schedule</label>
        <input
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="w-full bg-transparent border border-[#2D3E50] rounded-lg px-3 py-2 text-gray-200 focus:ring-1 focus:ring-[#06D6A0] outline-none font-mono text-sm"
          placeholder="0 2 * * 1"
        />
        <p className="text-gray-500 text-xs mt-1">e.g. 0 2 * * 1 = Every Monday at 2 AM</p>
      </div>

      <button
        onClick={saveSchedule}
        disabled={schedule.isPending || !enabled}
        className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
      >
        {schedule.isPending ? "Saving…" : "Save Schedule"}
      </button>
    </div>
  );
}
