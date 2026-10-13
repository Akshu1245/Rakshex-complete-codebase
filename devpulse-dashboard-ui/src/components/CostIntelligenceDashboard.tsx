'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';

interface CostBreakdown {
  total_cost_usd: number;
  total_calls: number;
  avg_cost_per_call: number;
  by_provider: Record<string, number>;
  by_model: Record<string, number>;
  by_day: Record<string, number>;
  top_model: string;
}

export default function CostIntelligenceDashboard() {
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/v1/costs/breakdown?days=30`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [API]);

  const formatUSD = (n: number) => `$${n.toFixed(2)}`;

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Cost Intelligence"
        subtitle="Track and optimize your AI API spending"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        badge={{ label: '30 days', variant: 'default' }}
      />

      {data ? (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Spend', value: formatUSD(data.total_cost_usd), accent: 'text-zinc-100' },
              { label: 'API Calls', value: data.total_calls.toLocaleString(), accent: 'text-emerald-400' },
              { label: 'Avg / Call', value: formatUSD(data.avg_cost_per_call), accent: 'text-violet-400' },
              { label: 'Top Model', value: data.top_model, accent: 'text-amber-400' },
            ].map((m) => (
              <div key={m.label} className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 hover:border-zinc-600/40 transition-colors">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-2">{m.label}</div>
                <div className={`text-xl font-bold tracking-tight truncate ${m.accent}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Provider & Model breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">By Provider</h4>
              <div className="space-y-1.5">
                {Object.entries(data.by_provider).map(([provider, cost]) => {
                  const pct = data.total_cost_usd > 0 ? (cost / data.total_cost_usd) * 100 : 0;
                  return (
                    <div key={provider} className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="text-sm text-zinc-300 capitalize truncate">{provider}</span>
                        <Badge variant="default">{pct.toFixed(0)}%</Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-20 bg-zinc-700/40 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-zinc-200 w-16 text-right tabular-nums">{formatUSD(cost)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">By Model</h4>
              <div className="space-y-1.5">
                {Object.entries(data.by_model).slice(0, 5).map(([model, cost]) => (
                  <div key={model} className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                    <span className="text-xs text-zinc-400 font-mono truncate flex-1 min-w-0">{model}</span>
                    <span className="text-sm font-semibold text-zinc-200 tabular-nums shrink-0 ml-3">{formatUSD(cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          title="No cost data available"
          description="Start making API calls to see your spending breakdown here."
        />
      )}
    </Card>
  );
}
