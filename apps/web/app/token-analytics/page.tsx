"use client";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

export default function TokenAnalyticsPage() {
  const analyticsQuery = trpc.tokenAnalytics.getAnalytics.useQuery({ days: 30 });
  const analytics = analyticsQuery.data;
  const loading = analyticsQuery.isLoading;

  const totalCost = analytics?.totalCost ?? 0;
  const totalTokens = analytics?.totalTokens ?? 0;
  const byModel = analytics?.byModel ?? [];
  const usage = analytics?.usage ?? [];
  const maxCost = byModel.length > 0 ? Math.max(...byModel.map((m) => m.costUSD)) : 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-transparent text-on-background overflow-x-hidden">
      <div className="max-w-7xl mx-auto min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div className="min-w-0">
            <span
              className="text-primary"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              AI GOVERNANCE
            </span>
            <h2
              className="text-on-surface mt-1 break-words"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(26px, 7vw, 32px)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Token Analytics
            </h2>
          </div>
          <button
            className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              file_download
            </span>
            EXPORT REPORT
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
              <div className="glass-card p-4 sm:p-6 rounded-xl relative overflow-hidden min-w-0">
                <div className="scan-line"></div>
                <p
                  className="text-on-surface-variant mb-4 flex items-center gap-2"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    payments
                  </span>
                  TOTAL COST (LAST 30D)
                </p>
                <h2
                  className="text-primary break-all"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "clamp(32px, 9vw, 40px)",
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  ${totalCost < 0.01 && totalCost > 0 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
                </h2>
                <p className="text-on-surface-variant mt-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                  Across all models
                </p>
              </div>

              <div className="glass-card p-4 sm:p-6 rounded-xl min-w-0">
                <p
                  className="text-on-surface-variant mb-4 flex items-center gap-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>toll</span>
                  TOTAL TOKENS (LAST 30D)
                </p>
                <h2
                  className="text-on-surface break-all"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 9vw, 40px)", fontWeight: 700, lineHeight: 1.1 }}
                >
                  {totalTokens > 1000000
                    ? `${(totalTokens / 1000000).toFixed(1)}M`
                    : totalTokens > 1000
                      ? `${(totalTokens / 1000).toFixed(1)}K`
                      : totalTokens.toLocaleString()}
                </h2>
                <p className="text-tertiary mt-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                  Prompt + completion tokens
                </p>
              </div>

              <div className="glass-card p-4 sm:p-6 rounded-xl min-w-0 sm:col-span-2 lg:col-span-1">
                <p
                  className="text-on-surface-variant mb-4 flex items-center gap-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>psychology</span>
                  ACTIVE MODELS
                </p>
                <h2
                  className="text-on-surface"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 9vw, 40px)", fontWeight: 700, lineHeight: 1.1 }}
                >
                  {byModel.length}
                </h2>
                <p className="text-on-surface-variant mt-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                  Models tracked this period
                </p>
              </div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden mb-6 min-w-0">
              <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
                <h3 className="text-on-surface break-words" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}>
                  COST BREAKDOWN BY MODEL
                </h3>
              </div>
              {byModel.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    icon={<span className="material-symbols-outlined" style={{ fontSize: "32px" }}>bar_chart_4_bars</span>}
                    title="No token usage tracked yet"
                    description="Connect an LLM provider via OpenRouter or direct API key to start tracking costs per request."
                    actions={[{ label: "Open Settings", href: "/settings" }]}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto mobile-scroll-x">
                  <table className="w-full min-w-[720px] text-left" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <thead>
                      <tr className="text-on-surface-variant border-b border-outline-variant/10" style={{ fontSize: "10px", letterSpacing: "0.1em" }}>
                        <th className="px-4 sm:px-6 py-4 font-bold">MODEL</th>
                        <th className="px-4 sm:px-6 py-4 font-bold">PROMPT TOKENS</th>
                        <th className="px-4 sm:px-6 py-4 font-bold">COMPLETION TOKENS</th>
                        <th className="px-4 sm:px-6 py-4 font-bold">EFFICIENCY</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-right">COST (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {byModel.map((item) => (
                        <tr key={item.model} className="hover:bg-surface-variant/20 transition-colors">
                          <td className="px-4 sm:px-6 py-4 font-bold text-primary break-all">{item.model}</td>
                          <td className="px-4 sm:px-6 py-4 text-on-surface-variant">{item.promptTokens.toLocaleString()}</td>
                          <td className="px-4 sm:px-6 py-4 text-on-surface-variant">{item.completionTokens.toLocaleString()}</td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden max-w-[120px]">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.round((item.costUSD / maxCost) * 100)}%` }}></div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right text-primary font-bold">
                            ${item.costUSD < 0.01 && item.costUSD > 0 ? item.costUSD.toFixed(4) : item.costUSD.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl overflow-hidden mb-20 min-w-0">
              <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low/50">
                <h3 className="text-on-surface break-words" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}>
                  DAILY USAGE STREAM (LAST 30D)
                </h3>
              </div>
              {usage.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    icon={<span className="material-symbols-outlined" style={{ fontSize: "32px" }}>timeline</span>}
                    title="No token usage tracked yet"
                    description="Connect an LLM provider via OpenRouter or direct API key to start tracking costs per request."
                    compact
                  />
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto mobile-scroll-x">
                  <table className="w-full min-w-[600px] text-left" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <thead className="sticky top-0 bg-surface-container-low">
                      <tr className="text-on-surface-variant border-b border-outline-variant/10" style={{ fontSize: "10px", letterSpacing: "0.1em" }}>
                        <th className="px-4 sm:px-6 py-4 font-bold">MODEL</th>
                        <th className="px-4 sm:px-6 py-4 font-bold">DATE</th>
                        <th className="px-4 sm:px-6 py-4 font-bold">TOKENS</th>
                        <th className="px-4 sm:px-6 py-4 font-bold text-right">COST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {usage.map((record, i) => (
                        <tr key={i} className="hover:bg-surface-variant/20 transition-colors">
                          <td className="px-4 sm:px-6 py-4 text-primary break-all">{record.model}</td>
                          <td className="px-4 sm:px-6 py-4 text-on-surface-variant">{new Date(record.date).toLocaleDateString()}</td>
                          <td className="px-4 sm:px-6 py-4 text-on-surface-variant">{record.tokens.toLocaleString()}</td>
                          <td className="px-4 sm:px-6 py-4 text-right text-primary">
                            ${record.cost < 0.01 && record.cost > 0 ? record.cost.toFixed(4) : record.cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="fixed bottom-0 left-0 md:left-64 right-0 min-h-10 bg-surface-container-lowest/90 backdrop-blur-lg border-t border-outline-variant/10 z-30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="text-on-surface-variant truncate" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em" }}>
              TOKEN ANALYTICS: OPERATIONAL
            </span>
          </div>
          <span className="hidden sm:block text-on-surface-variant shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em" }}>
            RaksHex AI — SYSTEM ALPHA-9
          </span>
        </div>
      </div>
    </div>
  );
}