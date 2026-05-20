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
        const mappedFindings: Finding[] = runs.runs
          .flatMap((r) =>
            (r.findings || []).map((f) => ({
              id: String(f.id),
              category: f.category,
              severity: f.severity,
              description: f.sample || `Outcome: ${f.outcome}`,
              model: r.target,
              createdAt:
                f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
            })),
          )
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
      const mappedFindings: Finding[] = runs.runs
        .flatMap((r) =>
          (r.findings || []).map((f) => ({
            id: String(f.id),
            category: f.category,
            severity: f.severity,
            description: f.sample || `Outcome: ${f.outcome}`,
            model: r.target,
            createdAt:
              f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
          })),
        )
        .slice(0, 50);
      setFindings(mappedFindings);
    } catch (err) {
      alert("Run failed: " + (err as Error).message);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "Critical":
        return "text-red-400 bg-red-900/30 border-red-700/40";
      case "High":
        return "text-orange-400 bg-orange-900/30 border-orange-700/40";
      case "Medium":
        return "text-yellow-400 bg-yellow-900/30 border-yellow-700/40";
      default:
        return "text-gray-400 bg-gray-800/50 border-gray-600/30";
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
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-medium"
        >
          Run Now
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-lg p-1 w-fit">
        {(["trends", "findings", "schedule"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
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
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Resilience Trend (30 days)</h2>
            {loading ? (
              <div className="h-80 bg-gray-900/50 rounded-lg animate-pulse" />
            ) : trendData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-400">
                No trend data available. Run your first red-team test.
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#E5E7EB" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Overall"
                      stroke="#60A5FA"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="injection"
                      name="Injection"
                      stroke="#F87171"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="leakage"
                      name="Leakage"
                      stroke="#FBBF24"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="jailbreak"
                      name="Jailbreak"
                      stroke="#A78BFA"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="toxicity"
                      name="Toxicity"
                      stroke="#34D399"
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
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
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
              <thead className="bg-gray-700/30 text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {findings.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-700/20">
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
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <SchedulePanel />
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score, previous }: { label: string; score: number; previous: number }) {
  const delta = score - previous;
  const deltaColor = delta >= 0 ? "text-green-400" : "text-red-400";
  const deltaIcon = delta >= 0 ? "↑" : "↓";

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
          className={`w-12 h-6 rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-600"}`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-2">Cron schedule</label>
        <input
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 font-mono text-sm"
          placeholder="0 2 * * 1"
        />
        <p className="text-gray-500 text-xs mt-1">e.g. 0 2 * * 1 = Every Monday at 2 AM</p>
      </div>

      <button
        onClick={saveSchedule}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
      >
        Save Schedule
      </button>
    </div>
  );
}
