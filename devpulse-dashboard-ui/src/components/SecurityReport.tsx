'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';

interface OptTip {
  type: string;
  priority: string;
  title: string;
  description: string;
  estimated_monthly_savings_usd: number;
  current_model?: string;
  suggested_model?: string;
}

export default function SecurityReport() {
  const [tips, setTips] = useState<OptTip[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/v1/costs/optimization`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setTips(data.tips || []);
          setTotalSavings(data.total_potential_monthly_savings_usd || 0);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchTips();
  }, [API]);

  const priorityVariant = (p: string): 'danger' | 'warning' | 'info' => {
    if (p === 'high') return 'danger';
    if (p === 'medium') return 'warning';
    return 'info';
  };

  const typeIcon = (t: string) => {
    const icons: Record<string, React.ReactNode> = {
      model_switch: <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      caching: <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
      token_optimization: <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L4.939 4.939m0 14.122A8 8 0 1119.06 4.94 8 8 0 014.94 19.06z" /></svg>,
      batching: <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    };
    return icons[t] || <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
  };

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Optimization Report"
        subtitle="Cost savings recommendations based on your usage"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        action={
          totalSavings > 0 ? (
            <div className="text-right">
              <div className="text-lg font-black text-emerald-400 tabular-nums">${totalSavings.toFixed(2)}/mo</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Potential savings</div>
            </div>
          ) : undefined
        }
      />

      {tips.length === 0 ? (
        <EmptyState
          icon={<svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="Fully optimized!"
          description="Your spending is already at peak efficiency."
        />
      ) : (
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="bg-zinc-800/20 border border-zinc-700/30 rounded-xl p-4 hover:border-zinc-600/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {typeIcon(tip.type)}
                    <Badge variant={priorityVariant(tip.priority)} dot>{tip.priority}</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{tip.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{tip.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-emerald-400 tabular-nums">
                    -${tip.estimated_monthly_savings_usd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">per month</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
