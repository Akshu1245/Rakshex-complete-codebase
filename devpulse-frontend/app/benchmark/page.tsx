"use client";
import { useState } from "react";
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
import { Gauge, Play, RefreshCw, CheckCircle } from "lucide-react";

const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    color: "#06D6A0",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    color: "#00F0FF",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
  },
  { id: "gemini", label: "Gemini", color: "#FDB022", models: ["gemini-1.5-pro", "gemini-flash"] },
];

const BENCHMARK_RESULTS = [
  {
    model: "gpt-4o-mini",
    successRate: 98.2,
    avgLatency: 680,
    costPer1k: 0.15,
    p95: 1200,
    throughput: 45,
  },
  {
    model: "claude-3-haiku",
    successRate: 97.8,
    avgLatency: 720,
    costPer1k: 0.25,
    p95: 1350,
    throughput: 38,
  },
  {
    model: "gemini-flash",
    successRate: 96.5,
    avgLatency: 450,
    costPer1k: 0.075,
    p95: 890,
    throughput: 62,
  },
  {
    model: "gpt-4o",
    successRate: 99.1,
    avgLatency: 1800,
    costPer1k: 5.0,
    p95: 3200,
    throughput: 18,
  },
  {
    model: "claude-3-sonnet",
    successRate: 98.5,
    avgLatency: 1400,
    costPer1k: 3.0,
    p95: 2600,
    throughput: 22,
  },
];

const RADAR_DATA = [
  { metric: "Speed", "gpt-4o-mini": 78, "claude-3-haiku": 72, "gemini-flash": 95 },
  { metric: "Quality", "gpt-4o-mini": 85, "claude-3-haiku": 88, "gemini-flash": 80 },
  { metric: "Cost", "gpt-4o-mini": 88, "claude-3-haiku": 75, "gemini-flash": 95 },
  { metric: "Reliability", "gpt-4o-mini": 98, "claude-3-haiku": 97, "gemini-flash": 96 },
  { metric: "Context", "gpt-4o-mini": 72, "claude-3-haiku": 90, "gemini-flash": 85 },
];

export default function BenchmarkPage() {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [selectedModels, setSelectedModels] = useState([
    "gpt-4o-mini",
    "claude-3-haiku",
    "gemini-flash",
  ]);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const runBenchmark = () => {
    setRunning(true);
    setCompleted(false);
    setTimeout(() => {
      setRunning(false);
      setCompleted(true);
    }, 3000);
  };

  const filteredResults = BENCHMARK_RESULTS.filter((r) => selectedModels.includes(r.model));

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gauge className="w-8 h-8 text-[#06D6A0]" />
            LLM Benchmark
          </h1>
          <p className="text-gray-400 mt-1">
            Compare models across speed, cost, quality, and reliability
          </p>
        </div>
      </div>

      {/* Config panel */}
      <div className="bg-[#1E293B] rounded-xl border border-[#2D3E50] p-6 mb-8">
        <h3 className="font-semibold text-white mb-4">Configure Benchmark</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Select Models</p>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => (
                <div key={provider.id}>
                  <p className="text-xs font-semibold mb-1" style={{ color: provider.color }}>
                    {provider.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {provider.models.map((model) => (
                      <button
                        key={model}
                        onClick={() => toggleModel(model)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedModels.includes(model) ? "text-white border-transparent" : "text-gray-400 border-[#2D3E50] hover:border-gray-500 bg-[#0A0E1A]/40"}`}
                        style={
                          selectedModels.includes(model)
                            ? {
                                backgroundColor: provider.color + "20",
                                borderColor: provider.color + "80",
                                color: provider.color,
                              }
                            : {}
                        }
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Settings</p>
            <div className="space-y-3">
              {[
                { label: "Request Count", value: "100" },
                { label: "Prompt Type", value: "Mixed (summarization + Q&A + code)" },
                { label: "Timeout (ms)", value: "5000" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{s.label}</span>
                  <span className="text-sm text-white bg-[#0A0E1A] border border-[#2D3E50] px-3 py-1 rounded">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={runBenchmark}
              disabled={running || selectedModels.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Running...
                </>
              ) : completed ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Re-run Benchmark
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Run Benchmark
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-[#1E293B] rounded-xl border border-[#2D3E50] p-5">
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
              <Bar
                dataKey="avgLatency"
                fill="#06D6A0"
                radius={[4, 4, 0, 0]}
                name="Avg Latency (ms)"
              />
              <Bar dataKey="p95" fill="#00F0FF" radius={[4, 4, 0, 0]} name="P95 Latency (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1E293B] rounded-xl border border-[#2D3E50] p-5">
          <h3 className="font-semibold text-white mb-4">Performance Radar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="#2D3E50" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Radar
                name="gpt-4o-mini"
                dataKey="gpt-4o-mini"
                stroke="#06D6A0"
                fill="#06D6A0"
                fillOpacity={0.15}
              />
              <Radar
                name="claude-3-haiku"
                dataKey="claude-3-haiku"
                stroke="#00F0FF"
                fill="#00F0FF"
                fillOpacity={0.15}
              />
              <Radar
                name="gemini-flash"
                dataKey="gemini-flash"
                stroke="#FDB022"
                fill="#FDB022"
                fillOpacity={0.15}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-[#1E293B] rounded-xl border border-[#2D3E50] overflow-hidden">
        <div className="p-4 border-b border-[#2D3E50]">
          <h3 className="font-semibold text-white">Full Results</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2D3E50]">
                {[
                  "Model",
                  "Success Rate",
                  "Avg Latency",
                  "P95",
                  "Cost/1K tokens",
                  "Throughput (req/s)",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResults
                .sort((a, b) => b.successRate - a.successRate)
                .map((r, i) => (
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
                    <td className="px-4 py-3 text-gray-300">{r.throughput}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
