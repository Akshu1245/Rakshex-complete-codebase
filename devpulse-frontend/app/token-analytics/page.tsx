"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function TokenAnalyticsPage() {
  const analyticsQuery = trpc.tokenAnalytics.getAnalytics.useQuery({
    days: 30,
  });
  const analytics = analyticsQuery.data;
  const loading = analyticsQuery.isLoading;

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">
              Token Analytics
            </h1>
            <p className="text-gray-400 mt-1">
              Track LLM token usage and costs by model
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Dashboard
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading analytics...</p>
        ) : (
          <div>
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="text-gray-400 text-sm uppercase tracking-wide">
                  Total cost (last 30d)
                </h3>
                <p className="text-3xl font-bold mt-2 text-green-400">
                  ${(analytics?.totalCost ?? 0) < 0.01 && (analytics?.totalCost ?? 0) > 0 ? (analytics?.totalCost ?? 0).toFixed(4) : (analytics?.totalCost ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="text-gray-400 text-sm uppercase tracking-wide">
                  Total tokens (last 30d)
                </h3>
                <p className="text-3xl font-bold mt-2 text-blue-400">
                  {(analytics?.totalTokens ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                Cost Breakdown by Model
              </h2>
              {analytics?.byModel && analytics.byModel.length > 0 ? (
                <div className="space-y-3">
                  {analytics.byModel.map(item => (
                    <div
                      key={item.model}
                      className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between"
                    >
                      <div>
                        <h3 className="font-semibold">{item.model}</h3>
                        <div className="text-sm text-gray-400 mt-1">
                          {item.promptTokens.toLocaleString()} prompt tokens
                        </div>
                        <div className="text-sm text-gray-400">
                          {item.completionTokens.toLocaleString()} completion
                          tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">
                          ${item.costUSD < 0.01 && item.costUSD > 0 ? item.costUSD.toFixed(4) : item.costUSD.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No data available</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">
                Daily Usage (last 30d)
              </h2>
              {analytics?.usage && analytics.usage.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analytics.usage.map((record, i) => (
                    <div
                      key={i}
                      className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center"
                    >
                      <div>
                        <span className="text-sm font-mono text-blue-300">
                          {record.model}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(record.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {record.tokens.toLocaleString()} tokens
                      </div>
                      <div className="text-green-400 text-sm">
                        ${record.cost < 0.01 && record.cost > 0 ? record.cost.toFixed(4) : record.cost.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No records yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
