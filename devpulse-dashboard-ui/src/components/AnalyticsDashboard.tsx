'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, AnalyticsTrends, AnalyticsInsight } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';

export default function AnalyticsDashboard() {
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [t, i, f] = await Promise.all([
        apiClient.getAnalyticsTrends(days),
        apiClient.getAnalyticsInsights(),
        apiClient.getAnalyticsForecast(7),
      ]);
      setTrends(t);
      setInsights(i.insights || []);
      setForecast(f);
    } catch { /* ignore */ }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  const insightBorder = (s: string) => {
    const map: Record<string, string> = { critical: 'border-red-500/40 bg-red-500/5', warning: 'border-amber-500/40 bg-amber-500/5', info: 'border-blue-500/40 bg-blue-500/5' };
    return map[s] || 'border-zinc-700/40 bg-zinc-800/20';
  };

  if (loading) return <CardSkeleton rows={5} />;

  return (
    <Card>
      <CardHeader
        title="Advanced Analytics"
        subtitle="Usage trends, insights, and forecasting"
        icon={
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        action={
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                  days === d
                    ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:text-zinc-200'
                }`}>
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-5">
        {/* Totals */}
        {trends && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-2xl font-bold text-blue-400 tabular-nums">{trends.totals.total_events}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Total Events</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">{trends.totals.api_calls}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">API Calls</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-2xl font-bold text-violet-400 tabular-nums">{trends.totals.code_generations}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Code Gens</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-2xl font-bold text-red-400 tabular-nums">{trends.totals.errors}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Errors</div>
            </div>
          </div>
        )}

        {/* Sparkline-style daily chart */}
        {trends && trends.daily.length > 0 && (
          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Daily Events ({days}d)</h3>
            <div className="flex items-end gap-1 h-24">
              {trends.daily.map((d, i) => {
                const maxVal = Math.max(...trends.daily.map((x) => x.total_events), 1);
                const h = (d.total_events / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="w-full bg-blue-500/50 rounded-t hover:bg-blue-400/70 transition-colors" style={{ height: `${Math.max(h, 2)}%` }} />
                    <div className="absolute -top-6 hidden group-hover:block bg-zinc-800 text-xs text-white px-2 py-1 rounded shadow border border-zinc-700">
                      {d.date.slice(5)}: {d.total_events}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Insights & Recommendations</h3>
            {insights.map((ins, i) => (
              <div key={i} className={`p-3 rounded-xl border-l-4 ${insightBorder(ins.severity)}`}>
                <p className="text-sm text-white">{ins.message}</p>
                <div className="flex items-start gap-1.5 mt-1.5 text-xs text-zinc-400">
                  <svg className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  {ins.recommendation}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Forecast */}
        {forecast && (forecast as Record<string, unknown[]>).forecast?.length > 0 && (
          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">7-Day Forecast</h3>
              <Badge variant={
                (forecast as Record<string, string>).confidence === 'high' ? 'success' :
                (forecast as Record<string, string>).confidence === 'medium' ? 'warning' : 'default'
              }>
                {(forecast as Record<string, string>).confidence} confidence
              </Badge>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {((forecast as Record<string, Record<string, unknown>[]>).forecast || []).map((f, i) => (
                <div key={i} className="text-center p-2 bg-zinc-800/40 rounded-lg border border-zinc-700/30">
                  <div className="text-sm font-medium text-blue-300 tabular-nums">{(f.predicted_events as number) || 0}</div>
                  <div className="text-[10px] text-zinc-500">{(f.date as string)?.slice(5) || ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
