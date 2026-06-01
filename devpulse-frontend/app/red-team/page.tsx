"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";
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
  injection: number;
  leakage: number;
  jailbreak: number;
  toxicity: number;
}

interface RedTeamRun {
  id: string;
  findings: Finding[];
  createdAt: string;
}

interface Finding {
  id: string;
  category: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  model: string;
  createdAt: string;
}

export default function RedTeamPage() {
  const [activeTab, setActiveTab] = useState<"trends" | "findings" | "schedule">("trends");
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  const utils = trpc.useContext();

  useEffect(() => {
    async function load() {
      try {
        const runs = await utils.client.runtimeGovernance.redteamRuns.query({ limit: 50 });
        const mappedFindings = (runs.runs as unknown as RedTeamRun[])
          .flatMap((r) => r.findings || [])
          .slice(0, 50);
        setFindings(mappedFindings);
      } catch (err) {
        console.error("Failed to load red-team data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [utils.client.runtimeGovernance]);

  const runNow = async () => {
    try {
      await utils.client.runtimeGovernance.startRedteam.mutate({
        target: window.location.origin,
      });
      const runs = await utils.client.runtimeGovernance.redteamRuns.query({ limit: 50 });
      const mappedFindings = runs.runs.flatMap((r: any) => r.findings || []).slice(0, 50);
      setFindings(mappedFindings as Finding[]);
    } catch (err) {
      alert("Run failed: " + (err as Error).message);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "Critical":
        return "text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/30";
      case "High":
        return "text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/30";
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
          className="px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#EF4444]/90 font-semibold transition-all"
        >
          Run Now
        </button>
      </div>

      {/* Tabs */}
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

      {/* Trends Tab */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          {/* Overall Score Card */}
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
                  label="Prompt Injection"
                  score={trendData[trendData.length - 1]?.injection ?? 0}
                  previous={trendData[trendData.length - 2]?.injection ?? 0}
                />
                <ScoreCard
                  label="Data Leakage"
                  score={trendData[trendData.length - 1]?.leakage ?? 0}
                  previous={trendData[trendData.length - 2]?.leakage ?? 0}
                />
                <ScoreCard
                  label="Jailbreak"
                  score={trendData[trendData.length - 1]?.jailbreak ?? 0}
                  previous={trendData[trendData.length - 2]?.jailbreak ?? 0}
                />
              </>
            )}
          </div>

          {/* Chart */}
          <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Resilience Trend (30 days)</h2>
            {loading ? (
              <div className="h-80 bg-transparent rounded-lg animate-pulse border border-[#2D3E50]" />
            ) : trendData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No trend data available. Run your first red-team test.
              </div>
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
                      name="Overall"
                      stroke="#06D6A0"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="injection"
                      name="Injection"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="leakage"
                      name="Leakage"
                      stroke="#FDB022"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="jailbreak"
                      name="Jailbreak"
                      stroke="#00F0FF"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="toxicity"
                      name="Toxicity"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === "findings" && (
        <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : findings.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No findings yet. Run a red-team test to discover vulnerabilities.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-transparent text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Model</th>
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
                    <td className="px-4 py-3 text-gray-300 max-w-md truncate">{f.description}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{f.model}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="bg-black/50/50 border border-[#2D3E50] rounded-lg p-6">
          <SchedulePanel />
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score, previous }: { label: string; score: number; previous: number }) {
  const delta = score - previous;
  const deltaColor = delta >= 0 ? "text-[#10B981]" : "text-[#EF4444]";
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
  const [models, setModels] = useState<string[]>(["all"]);
  const utils = trpc.useContext();

  const saveSchedule = async () => {
    try {
      await utils.client.runtimeGovernance.scheduleRedteam.mutate({
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
        className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-semibold rounded-lg hover:opacity-90 transition-all"
      >
        Save Schedule
      </button>
    </div>
  );
}
