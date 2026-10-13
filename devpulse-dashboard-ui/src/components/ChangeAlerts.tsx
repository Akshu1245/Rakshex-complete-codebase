'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ChangeAlert } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function ChangeAlerts() {
  const [alerts, setAlerts] = useState<ChangeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiClient.getChangeAlerts(50);
      setAlerts(data.alerts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchAlerts();
    }, 0);
    const intervalId = setInterval(() => {
      void fetchAlerts();
    }, 30000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [fetchAlerts]);

  const handleAck = async (id: string) => {
    await apiClient.ackChangeAlert(id);
    fetchAlerts();
  };

  const sevVariant = (s: string): 'danger' | 'warning' | 'info' => {
    if (s === 'breaking') return 'danger';
    if (s === 'major') return 'warning';
    return 'info';
  };

  if (loading) return <CardSkeleton rows={3} />;

  return (
    <Card>
      <CardHeader
        title="API Change Detection"
        subtitle="Monitor schema changes across tracked APIs"
        icon={
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
        badge={{ label: `${alerts.length} alerts`, variant: alerts.length > 0 ? 'warning' : 'success' }}
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No schema changes detected"
          description="Monitoring GitHub, CoinGecko, Reddit, NASA, Discord, Slack APIs for changes."
        />
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition-colors ${
                alert.acknowledged
                  ? 'border-zinc-800/60 bg-zinc-800/20 opacity-70'
                  : 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-zinc-200">{alert.api_name}</span>
                  <Badge variant={sevVariant(alert.severity)} dot>{alert.severity}</Badge>
                </div>
                {!alert.acknowledged && (
                  <Button variant="primary" size="sm" onClick={() => handleAck(alert.id)}>
                    Acknowledge
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs">
                {alert.changes?.added?.length > 0 && (
                  <span className="text-emerald-400 font-medium">+{alert.changes.added.length} added</span>
                )}
                {alert.changes?.removed?.length > 0 && (
                  <span className="text-red-400 font-medium">-{alert.changes.removed.length} removed</span>
                )}
                {Object.keys(alert.changes?.type_changed || {}).length > 0 && (
                  <span className="text-orange-400 font-medium">~{Object.keys(alert.changes.type_changed).length} changed</span>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 mt-2">{new Date(alert.detected_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
