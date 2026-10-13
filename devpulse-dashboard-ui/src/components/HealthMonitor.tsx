'use client';

import { useEffect, useState } from 'react';
import { apiClient, HealthStatus } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Shared';
import { Button, IconButton } from '@/components/ui/Button';

export default function HealthMonitor() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) return <CardSkeleton rows={4} />;

  if (error) {
    return (
      <Card>
        <CardHeader
          title="API Health Monitor"
          icon={
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
        />
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHealth} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  const apis = health?.apis || {};
  const healthyCount = Object.values(apis).filter(a => a.status === 'healthy').length;
  const totalCount = Object.keys(apis).length;
  const statusVariant = healthyCount === totalCount ? 'success' : healthyCount > 0 ? 'warning' : 'danger';

  return (
    <Card>
      <CardHeader
        title="API Health Monitor"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        badge={{ label: `${healthyCount}/${totalCount} Healthy`, variant: statusVariant }}
        action={
          <IconButton onClick={fetchHealth} disabled={loading} aria-label="Refresh">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </IconButton>
        }
      />

      {totalCount === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.01" />
            </svg>
          }
          title="No APIs monitored"
          description="Connect your APIs to start monitoring their health status."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {Object.entries(apis).map(([name, info]) => {
            const statusConfig = {
              healthy: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', dot: 'bg-emerald-500', text: 'text-emerald-400' },
              degraded: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', dot: 'bg-amber-500', text: 'text-amber-400' },
              down: { bg: 'bg-red-500/8', border: 'border-red-500/20', dot: 'bg-red-500', text: 'text-red-400' },
            }[info.status] || { bg: 'bg-red-500/8', border: 'border-red-500/20', dot: 'bg-red-500', text: 'text-red-400' };

            return (
              <div
                key={name}
                className={`${statusConfig.bg} ${statusConfig.border} border rounded-xl p-3 hover:brightness-110 transition-all`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-2 h-2 rounded-full ${statusConfig.dot} shrink-0`} />
                  <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {info.latency_ms > 0 ? `${info.latency_ms.toFixed(0)}ms` : 'N/A'}
                  </span>
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${statusConfig.text}`}>
                    {info.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {health?.timestamp && (
        <p className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-600">
          Last updated: {new Date(health.timestamp).toLocaleTimeString()}
        </p>
      )}
    </Card>
  );
}
