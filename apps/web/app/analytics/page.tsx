"use client";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnalyticsPage() {
  const fmtCost = (n: number) => (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2));
  const tokenQuery = trpc.tokenAnalytics.getAnalytics.useQuery({ days: 30 });
  const recentScansQuery = trpc.dashboard.getRecentScans.useQuery();
  const metricsQuery = trpc.dashboard.getMetrics.useQuery();
  const forecastQuery = trpc.runtimeGovernance.forecast.useQuery({ days: 30, horizon: 14 });

  const loading = tokenQuery.isLoading || recentScansQuery.isLoading || metricsQuery.isLoading;

  if (loading) {
    return (
      <div className="text-white flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  const tokenAnalytics = tokenQuery.data;
  const recentScans = recentScansQuery.data?.scans ?? [];
  const metrics = metricsQuery.data;
  const totalApiCalls = tokenAnalytics?.usage?.length ?? 0;
  const forecast = forecastQuery.data?.forecast;
  const chartData = [
    ...(forecast?.history ?? []).map((p) => ({
      date: p.date.slice(5),
      actual: p.estimatedCostUsd,
      projected: null as number | null,
    })),
    ...(forecast?.forecast ?? []).map((p) => ({
      date: p.date.slice(5),
      actual: null as number | null,
      projected: p.estimatedCostUsd,
    })),
  ];
  const projectedTotal = forecast?.forecast.reduce((s, p) => s + p.estimatedCostUsd, 0) ?? 0;

  return (
    <div className="text-white p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-400">Analytics</h1>
            <p className="text-gray-400 mt-1 break-words">
              Cost breakdown, forecast, and security event history
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center text-blue-400 hover:text-blue-300 shrink-0">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 min-w-0">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Cost (30d)</h3>
            <p className="text-3xl sm:text-4xl font-bold mt-2 text-green-400 break-all">
              ${fmtCost(tokenAnalytics?.totalCost ?? 0)}
            </p>
          </div>
          <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 min-w-0">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Token Records</h3>
            <p className="text-3xl sm:text-4xl font-bold mt-2 text-blue-400 break-all">{totalApiCalls}</p>
          </div>
          <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 min-w-0 sm:col-span-2 lg:col-span-1">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Findings</h3>
            <p className="text-3xl sm:text-4xl font-bold mt-2 text-purple-400 break-all">{metrics?.totalFindings ?? 0}</p>
          </div>
        </div>

        <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 mb-8 min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold">Cost forecast (14d)</h2>
              <p className="text-sm text-gray-400 mt-1 break-words">
                Holt-Winters projection from gateway spend
                {forecast
                  ? ` · method ${forecast.method} · confidence ${Math.round(forecast.confidence * 100)}%`
                  : ""}
              </p>
            </div>
            <p className="text-green-400 font-mono text-sm break-all shrink-0">
              Projected +${fmtCost(projectedTotal)}
            </p>
          </div>
          {forecastQuery.isLoading ? (
            <div className="h-56 sm:h-72 bg-gray-800/40 rounded animate-pulse" />
          ) : chartData.length === 0 ? (
            <EmptyState
              compact
              icon={<span>📈</span>}
              title="No forecast data yet"
              description="Route LLM traffic through the gateway so daily spend history can power a cost forecast."
            />
          ) : (
            <div className="h-56 sm:h-72 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 10 }} minTickGap={18} />
                  <YAxis
                    width={46}
                    stroke="#9CA3AF"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      maxWidth: "min(280px, 80vw)",
                    }}
                    formatter={(value: number | string) =>
                      value == null || value === "" ? "—" : `$${fmtCost(Number(value))}`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="#34D399"
                    fill="#34D39933"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    name="Forecast"
                    stroke="#60A5FA"
                    fill="#60A5FA22"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {(forecastQuery.data?.anomalies?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">
                Recent spend anomalies ({forecastQuery.data!.anomalies.length})
              </p>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {forecastQuery.data!.anomalies.slice(-8).map((a) => (
                  <li key={a.date} className="text-xs text-gray-400 flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
                    <span className="min-w-0 break-words">
                      {a.date} · {a.reason} (z={a.zScore})
                    </span>
                    <span className="text-yellow-400 shrink-0">${fmtCost(a.estimatedCostUsd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Daily Token Usage (last 30d)</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto min-w-0">
              {!tokenAnalytics || tokenAnalytics.usage.length === 0 ? (
                <EmptyState
                  compact
                  icon={<span>📊</span>}
                  title="No API calls yet"
                  description="Wire up the RaksHex SDK or VS Code extension so we can stream token usage into this view."
                />
              ) : (
                tokenAnalytics.usage.map((entry, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center bg-gray-700/50 p-3 rounded min-w-0"
                  >
                    <div className="min-w-0">
                      <span className="text-blue-300 font-mono text-sm break-all">{entry.model}</span>
                      <span className="block sm:inline text-gray-500 text-xs sm:ml-2">
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-green-400 shrink-0">${fmtCost(entry.cost ?? 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-black/50 p-4 sm:p-6 rounded-lg border border-gray-700 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Recent Scans</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto min-w-0">
              {recentScans.length === 0 ? (
                <EmptyState
                  compact
                  icon={<span>🛡️</span>}
                  title="No scans yet"
                  description="A clean board is a good board. Run a scan on your collections to surface potential issues."
                  actions={[
                    {
                      label: "Run a scan",
                      href: "/scanning",
                      variant: "secondary",
                    },
                  ]}
                />
              ) : (
                recentScans.map((scan) => (
                  <div key={scan.id} className="bg-gray-700/50 p-3 rounded min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start">
                      <span
                        className={`font-bold text-sm min-w-0 break-words ${
                          scan.riskLevel === "CRITICAL" || scan.riskLevel === "HIGH"
                            ? "text-red-400"
                            : scan.riskLevel === "MEDIUM"
                              ? "text-yellow-400"
                              : "text-blue-400"
                        }`}
                      >
                        {scan.collectionName} · {scan.riskLevel ?? "—"}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mt-1 break-words">
                      {scan.totalFindings} findings · risk {Math.round(scan.riskScore)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}