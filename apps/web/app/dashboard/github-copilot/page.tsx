"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function CopilotGovernancePage() {
  const { data: metrics, isLoading } = trpc.github.getCopilotMetrics.useQuery({
    org: "rakshex-org",
  });

  if (isLoading || !metrics) {
    return (
      <div className="p-8 text-white min-h-screen bg-[#090D16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-gray-400 text-sm font-mono">Loading Copilot Telemetry...</p>
        </div>
      </div>
    );
  }

  if (metrics.status === "unavailable") {
    return (
      <div className="min-h-screen bg-[#090D16] p-8 text-white">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Copilot governance
          </p>
          <h1 className="mt-3 text-3xl font-bold">No verified Copilot data yet</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
            Connect a GitHub organization and run a permitted Copilot sync. Rakshex only displays
            usage, seats, and costs returned by GitHub or explicitly imported by your workspace.
          </p>
          <Link
            href="/enterprise"
            className="mt-6 w-fit border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Configure Copilot sync
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-white min-h-screen bg-[#090D16]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight">
              GitHub Copilot Governance
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Seat utilization, subscription cost analytics, and active suggestion acceptance rates
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-all"
          >
            &larr; CommandCenter
          </Link>
        </div>

        {/* Actionable Recommendations Header Alert */}
        {metrics.wastedCostUsd > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-2xl">warning</span>
              <div>
                <h4 className="font-semibold text-red-200">
                  Cost Alert: Inactive Copilot Seats Detected
                </h4>
                <p className="text-xs text-red-300/80 mt-0.5">
                  We identified {metrics.assignedSeats - metrics.activeUsers30d} assigned seats with
                  zero activity in the last 14 days. Reclaiming them saves{" "}
                  <strong className="text-white">${metrics.wastedCostUsd}/mo</strong>.
                </p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs rounded transition-all">
              Optimize Now
            </button>
          </div>
        )}

        {/* Top KPI Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Seat Utilization */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Seat Utilization
              </span>
              <span className="material-symbols-outlined text-indigo-400">group</span>
            </div>
            <div className="mt-4">
              <h2 className="text-3xl font-bold text-white">{metrics.seatUtilization}%</h2>
              <p className="text-xs text-gray-400 mt-1">
                {metrics.activeUsers30d} of {metrics.assignedSeats} seats active this month
              </p>
            </div>
            <div className="mt-4 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                style={{ width: `${metrics.seatUtilization}%` }}
              ></div>
            </div>
          </div>

          {/* Monthly Spend */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Monthly Burn
              </span>
              <span className="material-symbols-outlined text-green-400">payments</span>
            </div>
            <div className="mt-4">
              <h2 className="text-3xl font-bold text-green-400">${metrics.monthlyCostUsd}</h2>
              <p className="text-xs text-gray-400 mt-1">Flat rate of $19 per user/month</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
              <span className="material-symbols-outlined text-xs">info</span>
              <span>Based on {metrics.assignedSeats} assigned licenses</span>
            </div>
          </div>

          {/* Sug. Acceptance Rate */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Avg Acceptance Rate
              </span>
              <span className="material-symbols-outlined text-teal-400">check_circle</span>
            </div>
            <div className="mt-4">
              <h2 className="text-3xl font-bold text-teal-400">{metrics.acceptanceRate}%</h2>
              <p className="text-xs text-gray-400 mt-1">Percentage of suggested code retained</p>
            </div>
            <div className="mt-4 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full"
                style={{ width: `${metrics.acceptanceRate}%` }}
              ></div>
            </div>
          </div>

          {/* Wasted Budget */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Unused Seat Cost
              </span>
              <span className="material-symbols-outlined text-red-400">monetization_on</span>
            </div>
            <div className="mt-4">
              <h2 className="text-3xl font-bold text-red-400">${metrics.wastedCostUsd}</h2>
              <p className="text-xs text-gray-400 mt-1">
                {metrics.assignedSeats - metrics.activeUsers30d} assigned seats with zero usage
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-red-300 font-medium">
              <span className="material-symbols-outlined text-xs">trending_down</span>
              <span>Potential savings of 22% on next bill</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User breakdown list */}
          <div className="lg:col-span-8 bg-black/40 border border-white/5 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">
              Seat Utilization & Acceptance Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-mono text-xs uppercase">
                    <th className="pb-3 font-normal">Developer</th>
                    <th className="pb-3 font-normal">Active Days (30d)</th>
                    <th className="pb-3 font-normal">Lines Accepted</th>
                    <th className="pb-3 font-normal">Acceptance Rate</th>
                    <th className="pb-3 font-normal text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {metrics.burners.map((b: any) => (
                    <tr key={b.email} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-indigo-400">
                          {b.name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-white">{b.name}</div>
                          <div className="text-xs text-gray-500">{b.email}</div>
                        </div>
                      </td>
                      <td className="py-4 font-mono">{b.activeDays}d</td>
                      <td className="py-4 font-mono">{b.linesAccepted.toLocaleString()}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{b.acceptanceRate}%</span>
                          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-400 rounded-full"
                              style={{ width: `${b.acceptanceRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            b.status === "Active"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Recommendations sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Recommendations card */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-200">Optimization Center</h3>
              <div className="space-y-4">
                {metrics.recommendations.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.severity === "High"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        }`}
                      >
                        {r.severity} Priority
                      </span>
                      {r.savings > 0 && (
                        <span className="text-xs text-green-400 font-mono font-bold">
                          +${r.savings}/mo
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">{r.title}</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{r.description}</p>
                    </div>
                    {r.type === "reclaim_seat" && (
                      <button className="w-full py-1.5 bg-primary text-on-primary hover:brightness-110 active:scale-[0.98] font-bold text-xs rounded transition-all">
                        Remove Seats via GitHub API
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Language Breakdown */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-200">Language Productivity</h3>
              <div className="space-y-3">
                {metrics.languageStats.map((l: any) => (
                  <div key={l.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-300">
                      <span>{l.name}</span>
                      <span className="font-mono text-gray-400">
                        {l.acceptanceRate}% Rate ({l.linesAccepted} lines)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{ width: `${l.acceptanceRate}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
