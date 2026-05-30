"use client";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";

export default function AnalyticsPage() {
  const fmtCost = (n: number) => (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2));
  const tokenQuery = trpc.tokenAnalytics.getAnalytics.useQuery({ days: 30 });
  const recentScansQuery = trpc.dashboard.getRecentScans.useQuery();
  const metricsQuery = trpc.dashboard.getMetrics.useQuery();

  const loading = tokenQuery.isLoading || recentScansQuery.isLoading || metricsQuery.isLoading;

  if (loading) {
    return (
      <div className="text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  const tokenAnalytics = tokenQuery.data;
  const recentScans = recentScansQuery.data?.scans ?? [];
  const metrics = metricsQuery.data;

  const totalApiCalls = tokenAnalytics?.usage?.length ?? 0;

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Analytics</h1>
            <p className="text-gray-400 mt-1">Cost breakdown and security event history</p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Cost (30d)</h3>
            <p className="text-4xl font-bold mt-2 text-green-400">
              ${fmtCost(tokenAnalytics?.totalCost ?? 0)}
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Token Records</h3>
            <p className="text-4xl font-bold mt-2 text-blue-400">{totalApiCalls}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Findings</h3>
            <p className="text-4xl font-bold mt-2 text-purple-400">{metrics?.totalFindings ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Daily Token Usage (last 30d)</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                    className="flex justify-between items-center bg-gray-700/50 p-3 rounded"
                  >
                    <div>
                      <span className="text-blue-300 font-mono text-sm">{entry.model}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-green-400">${fmtCost(entry.cost ?? 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Recent Scans</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                  <div key={scan.id} className="bg-gray-700/50 p-3 rounded">
                    <div className="flex justify-between items-center">
                      <span
                        className={`font-bold text-sm ${
                          scan.riskLevel === "CRITICAL" || scan.riskLevel === "HIGH"
                            ? "text-red-400"
                            : scan.riskLevel === "MEDIUM"
                              ? "text-yellow-400"
                              : "text-blue-400"
                        }`}
                      >
                        {scan.collectionName} · {scan.riskLevel ?? "—"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mt-1">
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
