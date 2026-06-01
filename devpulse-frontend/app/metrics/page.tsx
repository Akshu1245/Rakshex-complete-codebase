"use client";
import { useState } from "react";
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

const RANGE_OPTIONS = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const WEEKLY_DATA = [
  { day: "Mon", calls: 980, cost: 1.24, p95: 1200, errors: 3 },
  { day: "Tue", calls: 1200, cost: 2.11, p95: 1380, errors: 5 },
  { day: "Wed", calls: 1050, cost: 1.78, p95: 1100, errors: 2 },
  { day: "Thu", calls: 1400, cost: 3.2, p95: 1650, errors: 8 },
  { day: "Fri", calls: 1680, cost: 4.5, p95: 2100, errors: 12 },
  { day: "Sat", calls: 720, cost: 0.98, p95: 890, errors: 1 },
  { day: "Sun", calls: 540, cost: 0.71, p95: 780, errors: 0 },
];

const MODEL_MIX = [
  { name: "gpt-4o-mini", value: 48, color: "#06D6A0" },
  { name: "claude-3-haiku", value: 22, color: "#00F0FF" },
  { name: "gemini-flash", value: 18, color: "#FDB022" },
  { name: "gpt-4o", value: 8, color: "#10B981" },
  { name: "claude-3-sonnet", value: 4, color: "#F59E0B" },
];

const STAT_CARDS = [
  { label: "Total API Calls", value: "7,570", delta: "+12%", up: true, color: "text-[#3B82F6]" },
  { label: "Total LLM Cost", value: "$14.52", delta: "+8%", up: true, color: "text-[#10B981]" },
  {
    label: "Avg Latency (P95)",
    value: "1,443ms",
    delta: "-5%",
    up: false,
    color: "text-[#00F0FF]",
  },
  { label: "Error Rate", value: "0.42%", delta: "-18%", up: false, color: "text-[#06D6A0]" },
];

export default function MetricsPage() {
  const [range, setRange] = useState<Range>("7d");

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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p
              className={`text-xs mt-1 font-semibold ${s.up ? "text-[#EF4444]" : "text-[#10B981]"}`}
            >
              {s.delta} vs last period
            </p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* API calls chart */}
        <div className="lg:col-span-2 bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
          <h3 className="font-semibold text-white mb-4">API Calls & Cost Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3E50" />
              <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0A0E1A",
                  border: "1px solid #2D3E50",
                  borderRadius: "8px",
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="calls"
                fill="#06D6A0"
                radius={[4, 4, 0, 0]}
                name="API Calls"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Model mix */}
        <div className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
          <h3 className="font-semibold text-white mb-4">Model Mix</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={MODEL_MIX}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
              >
                {MODEL_MIX.map((entry, i) => (
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
            {MODEL_MIX.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-gray-400">{m.name}</span>
                </div>
                <span className="text-white font-medium">{m.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency trend */}
        <div className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
          <h3 className="font-semibold text-white mb-4">P95 Latency (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={WEEKLY_DATA}>
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
          <h3 className="font-semibold text-white mb-4">Error Count by Day</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY_DATA}>
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
              <Bar dataKey="errors" fill="#EF4444" radius={[4, 4, 0, 0]} name="Errors" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
