'use client';

import { useState, useEffect, useCallback } from 'react';
import { startPolling } from '@/lib/polling';
import { apiClient, ChangeAlert, Workspace } from '@/lib/api';
import { APIError, getAuthToken } from '@/lib/transport';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';
import MonitoredApis from '@/components/MonitoredApis';

type WS = Workspace & { role?: string };
const MANAGE = new Set(['owner', 'admin']);

function describeError(e: unknown): string {
  if (e instanceof APIError) {
    if (e.status === 401) return 'Sign in to view change alerts.';
    if (e.status === 403) return 'Only workspace owners and admins can acknowledge alerts.';
    if (e.status === 404) return 'Alert or workspace not found.';
    if (e.status === 503) return /migration/i.test(e.message)
      ? 'Change alerts are temporarily unavailable (database migration pending).'
      : `Service unavailable: ${e.message}`;
    if (e.status === 0) return 'Unable to reach the backend. Please retry.';
    return `Could not load change alerts (${e.status}).`;
  }
  return 'Could not load change alerts.';
}

export default function ChangeAlerts() {
  const [workspaces, setWorkspaces] = useState<WS[] | null>(null);
  const [wsId, setWsId] = useState<string>('');
  const [alerts, setAlerts] = useState<ChangeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadWorkspaces = useCallback(async () => {
    if (!getAuthToken()) { setError('Sign in to view change alerts.'); setLoading(false); return; }
    try {
      const data = await apiClient.listMyWorkspaces();
      const list = data.workspaces || [];
      setWorkspaces(list);
      setWsId(prev => prev || list[0]?.id || '');
      if (list.length === 0) setLoading(false);
    } catch (e) { setError(describeError(e)); setLoading(false); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!wsId) return;
    try {
      const data = await apiClient.getChangeAlerts(50, wsId);
      setAlerts(data.alerts || []);
      setError('');
    } catch (e) { setAlerts([]); setError(describeError(e)); }
    setLoading(false);
  }, [wsId]);

  useEffect(() => { const t = setTimeout(loadWorkspaces, 0); return () => clearTimeout(t); }, [loadWorkspaces]);
  useEffect(() => (wsId ? startPolling(fetchAlerts) : undefined), [wsId, fetchAlerts]);

  const current = workspaces?.find(w => w.id === wsId);
  const canManage = MANAGE.has((current?.role || '').toLowerCase());

  const handleAck = async (id: string) => {
    setActionError('');
    try { await apiClient.ackChangeAlert(id); await fetchAlerts(); }
    catch (e) { setActionError(describeError(e)); }
  };

  const sevVariant = (s: string): 'danger' | 'warning' | 'info' => {
    if (s === 'critical' || s === 'breaking') return 'danger';
    if (s === 'warning' || s === 'major') return 'warning';
    return 'info';
  };

  if (loading && !error) return <CardSkeleton rows={3} />;

  return (
    <Card>
      <CardHeader
        title="API Change Detection"
        subtitle="Schema changes for APIs your workspace monitors"
        icon={
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
        badge={{ label: `${alerts.length} alerts`, variant: alerts.length > 0 ? 'warning' : 'success' }}
      />

      {workspaces && workspaces.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="ca-ws" className="text-zinc-400">Workspace</label>
          <select id="ca-ws" data-testid="ca-workspace" value={wsId}
            onChange={e => { setWsId(e.target.value); setLoading(true); setActionError(''); }}
            className="bg-zinc-800 rounded-md px-2 py-1 text-zinc-200 max-w-full">
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {current?.role && <span data-testid="ca-role" className="text-zinc-500">role: {current.role}</span>}
        </div>
      )}

      {wsId && !error && <MonitoredApis key={wsId} workspaceId={wsId} canManage={canManage} onChange={fetchAlerts} />}

      {actionError && <p role="alert" data-testid="ca-action-error" className="mb-2 text-xs text-red-400">{actionError}</p>}

      {error ? (
        <div role="alert" data-testid="ca-error" className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-sm text-red-300">
          {error}
          {!error.startsWith('Sign in') && <Button size="sm" variant="ghost" className="ml-2" onClick={() => { setLoading(true); fetchAlerts(); }}>Retry</Button>}
        </div>
      ) : workspaces && workspaces.length === 0 ? (
        <div data-testid="ca-empty-noworkspace">
          <EmptyState
            icon={<span />}
            title="No workspace yet"
            description="Create or join a workspace to see change alerts for the APIs it depends on." />
        </div>
      ) : alerts.length === 0 ? (
        <div data-testid="ca-empty">
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No change alerts for this workspace"
            description="Alerts appear only for supported APIs this workspace monitors, and only for changes detected after you select them."
          />
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1" data-testid="ca-list">
          {alerts.map((alert) => {
            const ch = alert.details || alert.changes;
            return (
              <div key={alert.id} data-testid="ca-item"
                className={`p-4 rounded-xl border transition-colors ${
                  alert.acknowledged
                    ? 'border-zinc-800/60 bg-zinc-800/20 opacity-70'
                    : 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-zinc-200 truncate">{alert.api_name}</span>
                    <Badge variant={sevVariant(alert.severity)} dot>{alert.severity}</Badge>
                  </div>
                  {alert.acknowledged ? (
                    <span data-testid="ca-acked" className="text-xs text-zinc-500">Acknowledged</span>
                  ) : canManage ? (
                    <Button variant="primary" size="sm" onClick={() => handleAck(alert.id)}>Acknowledge</Button>
                  ) : (
                    <span data-testid="ca-readonly" className="text-xs text-zinc-500">Owner/admin can acknowledge</span>
                  )}
                </div>
                {alert.summary && <p className="text-xs text-zinc-400 mb-1">{alert.summary}</p>}
                <div className="flex items-center gap-4 text-xs">
                  {(ch?.added?.length ?? 0) > 0 && <span className="text-emerald-400 font-medium">+{ch!.added.length} added</span>}
                  {(ch?.removed?.length ?? 0) > 0 && <span className="text-red-400 font-medium">-{ch!.removed.length} removed</span>}
                  {Object.keys(ch?.type_changed || {}).length > 0 && <span className="text-orange-400 font-medium">~{Object.keys(ch!.type_changed).length} changed</span>}
                </div>
                <p className="text-[11px] text-zinc-600 mt-2">{new Date(alert.detected_at).toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
