"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import TokenSpendChart from "@/components/charts/TokenSpendChart";
import ModelMixChart from "@/components/charts/ModelMixChart";
import AgentLeaderboard from "@/components/charts/AgentLeaderboard";

function fmtCost(n: number) {
  return n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2);
}

export default function TelemetryDashboardPage() {
  const [range, setRange] = useState<"7d" | "30d" | "custom">("7d");
  const [startDate, endDate] = (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (range === "30d" ? 30 : 7));
    return [start.toISOString(), end.toISOString()];
  })();

  const summaryQuery = trpc.analytics.summary.useQuery(
    { startDate, endDate, groupBy: "day" },
    { refetchInterval: 30_000 },
  );

  const modelMixQuery = trpc.analytics.modelMix.useQuery(
    { startDate, endDate },
    { refetchInterval: 30_000 },
  );

  const leaderboardQuery = trpc.analytics.agentLeaderboard.useQuery(
    { startDate, endDate, limit: 10 },
    { refetchInterval: 30_000 },
  );

  const summary = summaryQuery.data ?? [];
  const modelMix = modelMixQuery.data ?? [];
  const leaderboard = leaderboardQuery.data ?? [];

  const totalRequests = summary.reduce((s, d) => s + d.requestCount, 0);
  const totalCost = summary.reduce((s, d) => s + d.totalCost, 0);
  const avgLatency =
    totalRequests > 0
      ? Math.round(
          summary.reduce((s, d) => s + d.avgLatencyP50 * d.requestCount, 0) / totalRequests,
        )
      : 0;
  const totalErrors = summary.reduce((s, d) => s + (d.requestCount * d.errorRate) / 100, 0);
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

  const loading = summaryQuery.isLoading || modelMixQuery.isLoading || leaderboardQuery.isLoading;

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">AI Telemetry</h1>
            <p className="text-gray-400 mt-1">Live AI agent monitoring and cost analytics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-black/50 rounded-lg border border-gray-700 overflow-hidden">
              {["7d", "30d"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r as "7d" | "30d")}
                  className={`px-4 py-2 text-sm transition-colors ${
                    range === r ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
            <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-black/50 p-5 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-sm">Total Requests</p>
                <p className="text-3xl font-bold mt-1">{totalRequests.toLocaleString()}</p>
              </div>
              <div className="bg-black/50 p-5 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-sm">Total Cost</p>
                <p className="text-3xl font-bold mt-1 text-green-400">${fmtCost(totalCost)}</p>
              </div>
              <div className="bg-black/50 p-5 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-sm">Avg Latency</p>
                <p className="text-3xl font-bold mt-1 text-blue-400">{avgLatency}ms</p>
              </div>
              <div className="bg-black/50 p-5 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-sm">Error Rate</p>
                <p
                  className={`text-3xl font-bold mt-1 ${errorRate > 5 ? "text-red-400" : "text-yellow-400"}`}
                >
                  {errorRate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TokenSpendChart
                data={summary.map((s) => ({
                  key: s.key,
                  totalCost: s.totalCost,
                  totalTokens: s.totalTokens,
                }))}
              />
              <ModelMixChart data={modelMix} />
            </div>

            {/* Leaderboard */}
            <AgentLeaderboard data={leaderboard} />
          </>
        )}
      </div>
    </div>
  );
}
