"use client";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import { Gauge, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

const MODEL_COLORS = ["#06D6A0", "#00F0FF", "#FDB022", "#10B981", "#F59E0B", "#3B82F6", "#EF4444"];

interface ModelResult {
  model: string;
  successRate: number;
  avgLatency: number;
  p95: number;
  costPer1k: number;
  requests: number;
}

export default function BenchmarkPage() {
  // Compare the user's real model usage over the last 30 days.
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);

  const summaryQuery = trpc.analytics.summary.useQuery({ startDate, endDate, groupBy: "model" });

  const allResults: ModelResult[] = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    return rows
      .filter((r) => r.requestCount > 0)
      .map((r) => ({
        model: r.key,
        successRate: Math.round((100 - r.errorRate) * 10) / 10,
        avgLatency: r.avgLatencyP50,
        p95: r.avgLatencyP95,
        costPer1k:
          r.totalTokens > 0 ? Math.round((r.totalCost / r.totalTokens) * 1000 * 10000) / 10000 : 0,
        requests: r.requestCount,
      }));
  }, [summaryQuery.data]);

  const [selectedModels, setSelectedModels] = useState<string[] | null>(null);

  // Default selection = all models present, until the user toggles.
  const effectiveSelected = selectedModels ?? allResults.map((r) => r.model);

  const toggleModel = (model: string) => {
    const base = selectedModels ?? allResults.map((r) => r.model);
    setSelectedModels(
      base.includes(model) ? base.filter((m) => m !== model) : [...base, model],
    );
  };

  const filteredResults = allResults
    .filter((r) => effectiveSelected.includes(r.model))
    .sort((a, b) => b.successRate - a.successRate);

  // Normalised 0-100 radar across the selected models (higher = better).
  const radarData = useMemo(() => {
    if (filteredResults.length === 0) return [];
    const minLatency = Math.min(...filteredResults.map((r) => r.avgLatency || Infinity));
    const minCost = Math.min(...filteredResults.map((r) => r.costPer1k || Infinity));
    const mk = (metric: string, fn: (r: ModelResult) => number) => {
      const row: Record<string, string | number> = { metric };
      for (const r of filteredResults) row[r.model] = Math.round(fn(r));
      return row;
    };
    return [
      mk("Speed", (r) => (r.avgLatency > 0 ? (minLatency / r.avgLatency) * 100 : 0)),
      mk("Cost", (r) => (r.costPer1k > 0 ? (minCost / r.costPer1k) * 100 : 100)),
      mk("Reliability", (r) => r.successRate),
    ];
  }, [filteredResults]);

  const loading = summaryQuery.isLoading;
  const hasData = allResults.length > 0;

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gauge className="w-8 h-8 text-[#06D6A0]" />
            LLM Benchmark
          </h1>
          <p className="text-gray-400 mt-1">
            Compare your models on real latency, cost, and reliability (last 30 days)
          </p>
        </div>
        <button
          onClick={() => summaryQuery.refetch()}
          disabled={loading}
          className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-semibold hover:opacity-90 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="bg-black/50 rounded-xl border border-[#2D3E50] p-6 animate-pulse h-64" />
      ) : !hasData ? (
        <EmptyState
          icon="📈"
          title="No model telemetry yet"
          description="The benchmark compares the models your agents actually call, using real latency, cost, and error data. Once telemetry flows in through the SDK or gateway, your live model comparison shows up here."
          actions={[
            { label: "View telemetry docs", href: "/docs", variant: "primary" },
            { label: "Back to dashboard", href: "/dashboard", variant: "secondary" },
          ]}
        />
      ) : (
        <>
          {/* Model selector */}
          <div className="bg-black/50 rounded-xl border border-[#2D3E50] p-6 mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Models in comparison</p>
            <div className="flex flex-wrap gap-2">
              {allResults.map((r, i) => {
                const active = effectiveSelected.includes(r.model);
                const color = MODEL_COLORS[i % MODEL_COLORS.length];
                return (
                  <button
                    key={r.model}
                    onClick={() => toggleModel(r.model)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? "text-white border-transparent" : "text-gray-400 border-[#2D3E50] hover:border-gray-500"}`}
                    style={
                      active
                        ? { backgroundColor: color + "20", borderColor: color + "80", color }
                        : {}
                    }
                  >
                    {r.model}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-black/50 rounded-xl border border-[#2D3E50] p-5">
              <h3 className="font-semibold text-white mb-4">Latency Comparison (ms)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={filteredResults}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
                  <XAxis dataKey="model" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0A0E1A",
                      border: "1px solid #2D3E50",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="avgLatency" fill="#06D6A0" radius={[4, 4, 0, 0]} name="P50 Latency (ms)" />
                  <Bar dataKey="p95" fill="#00F0FF" radius={[4, 4, 0, 0]} name="P95 Latency (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-black/50 rounded-xl border border-[#2D3E50] p-5">
              <h3 className="font-semibold text-white mb-4">Performance Radar</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#2D3E50" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  {filteredResults.map((r, i) => {
                    const color = MODEL_COLORS[i % MODEL_COLORS.length];
                    return (
                      <Radar
                        key={r.model}
                        name={r.model}
                        dataKey={r.model}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.15}
                      />
                    );
                  })}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard table */}
          <div className="bg-black/50 rounded-xl border border-[#2D3E50] overflow-hidden">
            <div className="p-4 border-b border-[#2D3E50]">
              <h3 className="font-semibold text-white">Full Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2D3E50]">
                    {["Model", "Success Rate", "P50 Latency", "P95", "Cost/1K tokens", "Requests"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr
                      key={r.model}
                      className="border-b border-[#2D3E50]/50 hover:bg-[#06D6A0]/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-[#FDB022]">🥇</span>}
                          {i === 1 && <span className="text-gray-300">🥈</span>}
                          {i === 2 && <span className="text-amber-600">🥉</span>}
                          <span className="font-medium text-white">{r.model}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#10B981] font-semibold">{r.successRate}%</td>
                      <td className="px-4 py-3 text-gray-300">{r.avgLatency}ms</td>
                      <td className="px-4 py-3 text-gray-300">{r.p95}ms</td>
                      <td className="px-4 py-3 text-gray-300">${r.costPer1k}</td>
                      <td className="px-4 py-3 text-gray-300">{r.requests.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
