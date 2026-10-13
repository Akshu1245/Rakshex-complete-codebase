'use client';

import { useEffect, useState } from 'react';
import { apiClient, DashboardData } from '@/lib/api';

export default function DashboardStats() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const data = await apiClient.getDashboard();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-16 bg-zinc-800 rounded" />
              <div className="w-9 h-9 bg-zinc-800 rounded-xl" />
            </div>
            <div className="h-7 w-12 bg-zinc-800 rounded mt-2" />
            <div className="h-3 w-20 bg-zinc-800/40 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400">
        {error || 'Failed to load dashboard data'}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total APIs',
      value: dashboard.total_apis,
      subtitle: 'Monitored endpoints',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      accent: 'text-blue-400',
    },
    {
      label: 'Healthy',
      value: dashboard.healthy_apis,
      subtitle: `${dashboard.total_apis > 0 ? ((dashboard.healthy_apis / dashboard.total_apis) * 100).toFixed(0) : 0}% of total`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: 'text-emerald-400',
    },
    {
      label: 'Avg Latency',
      value: `${dashboard.avg_latency_ms.toFixed(0)}ms`,
      subtitle: dashboard.avg_latency_ms < 300 ? 'Healthy response time' : 'Above threshold',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: dashboard.avg_latency_ms < 300 ? 'text-emerald-400' : 'text-amber-400',
    },
    {
      label: 'Uptime',
      value: `${dashboard.uptime_percentage.toFixed(1)}%`,
      subtitle: dashboard.uptime_percentage >= 99.9 ? 'Excellent' : 'Needs attention',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      accent: dashboard.uptime_percentage >= 99.9 ? 'text-emerald-400' : 'text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 hover:border-zinc-700/60 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{stat.label}</span>
            <div className="w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 group-hover:border-zinc-600/60 transition-colors">
              {stat.icon}
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${stat.accent}`}>{stat.value}</p>
          <p className="text-[11px] text-zinc-500 mt-1">{stat.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
