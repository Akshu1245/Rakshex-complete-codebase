"use client";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

const RANGE_OPTIONS = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

const MIX_COLORS = ["#06D6A0", "#00F0FF", "#FDB022", "#10B981", "#F59E0B", "#3B82F6", "#EF4444"];

function rangeToDates(range: Range): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export default function MetricsPage() {
  const [range, setRange] = useState<Range>("7d");
  const { startDate, endDate } = useMemo(() => rangeToDates(range), [range]);

  const summaryQuery = trpc.analytics.summary.useQuery({ startDate, endDate, groupBy: "day" });
  const modelMixQuery = trpc.analytics.modelMix.useQuery({ startDate, endDate });

  const loading = summaryQuery.isLoading || modelMixQuery.isLoading;

  // Time-series rows sorted ascending by day key (YYYY-MM-DD).
  const series = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    return [...rows]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({
        day: r.key.slice(5), // MM-DD for compact axis labels
        calls: r.requestCount,
        cost: r.totalCost,
        p95: r.avgLatencyP95,
        errorRate: r.errorRate,
        tokens: r.totalTokens,
      }));
  }, [summaryQuery.data]);

  const modelMix = useMemo(() => {
    const rows = modelMixQuery.data ?? [];
    const totalRequests = rows.reduce((sum, m) => sum + m.requests, 0);
    if (totalRequests === 0) return [];
    return rows.slice(0, 7).map((m, i) => ({
      name: m.model || m.provider,
      value: Math.round((m.requests / totalRequests) * 100),
      color: MIX_COLORS[i % MIX_COLORS.length],
    }));
  }, [modelMixQuery.data]);

  const stats = useMemo(() => {
    const totalCalls = series.reduce((s, r) => s + r.calls, 0);
    const totalCost = series.reduce((s, r) => s + r.cost, 0);
    const totalTokens = series.reduce((s, r) => s + r.tokens, 0);
    const withCalls = series.filter((r) => r.calls > 0);
    const avgP95 = withCalls.length
      ? Math.round(withCalls.reduce((s, r) => s + r.p95, 0) / withCalls.length)
      : 0;
    const weightedErr = totalCalls
      ? series.reduce((s, r) => s + (r.errorRate / 100) * r.calls, 0) / totalCalls
      : 0;
    return {
      totalCalls,
      totalCost: Math.round(totalCost * 100) / 100,
      totalTokens,
      avgP95,
      errorRate: Math.round(weightedErr * 10000) / 100,
    };
  }, [series]);

  const hasData = series.some((r) => r.calls > 0);

  const statCards = [
    {
      label: "Total API Calls",
      value: stats.totalCalls.toLocaleString(),
      color: "text-[#3B82F6]",
    },
    {
      label: "Total LLM Cost",
      value: `$${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      color: "text-[#10B981]",
    },
    {
      label: "Avg Latency (P95)",
      value: `${stats.avgP95.toLocaleString()}ms`,
      color: "text-[#00F0FF]",
    },
    {
      label: "Error Rate",
      value: `${stats.errorRate}%`,
      color: "text-[#06D6A0]",
    },
  ];

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Platform Metrics</h1>
          <p className="text-gray-400 mt-1">
            Performance, cost, and reliability across all your agents
          </p>
        </div>
        <div className="flex gap-1 bg-black/50 rounded-lg p-1 border border-[#2D3E50]">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${range === r ? "bg-[#06D6A0] text-[#0A0E1A]" : "text-gray-400 hover:text-white"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-black/50 rounded-xl p-5 border border-[#2D3E50] animate-pulse h-[88px]"
            />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon="📊"
          title="No telemetry yet"
          description="Metrics populate automatically once your agents start sending AI telemetry events. Install the RaksHex SDK or pipe events through the gateway to see live cost, latency, and error trends here."
          actions={[
            { label: "View telemetry docs", href: "/docs", variant: "primary" },
            { label: "Set up alerts", href: "/settings", variant: "secondary" },
          ]}
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => (
              <div key={s.label} className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs mt-1 font-semibold text-gray-500">in selected range</p>
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* API calls chart */}
            <div className="lg:col-span-2 bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
              <h3 className="font-semibold text-white mb-4">API Calls Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
                  <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0A0E1A",
                      border: "1px solid #2D3E50",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="calls" fill="#06D6A0" radius={[4, 4, 0, 0]} name="API Calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Model mix */}
            <div className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
              <h3 className="font-semibold text-white mb-4">Model Mix</h3>
              {modelMix.length === 0 ? (
                <p className="text-gray-500 text-sm">No model usage in this range.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={modelMix}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        dataKey="value"
                      >
                        {modelMix.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0A0E1A",
                          border: "1px solid #2D3E50",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {modelMix.map((m) => (
                      <div key={m.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                          <span className="text-gray-400">{m.name}</span>
                        </div>
                        <span className="text-white font-medium">{m.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latency trend */}
            <div className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
              <h3 className="font-semibold text-white mb-4">P95 Latency (ms)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
                  <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0A0E1A",
                      border: "1px solid #2D3E50",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="p95"
                    stroke="#00F0FF"
                    strokeWidth={2}
                    dot={{ fill: "#00F0FF", r: 4 }}
                    name="P95 Latency"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Error rate */}
            <div className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
              <h3 className="font-semibold text-white mb-4">Error Rate by Day (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
                  <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0A0E1A",
                      border: "1px solid #2D3E50",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="errorRate"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    name="Error Rate %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
