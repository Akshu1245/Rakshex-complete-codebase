'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, AlertConfig, KillSwitch } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function AlertManager() {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [killSwitches, setKillSwitches] = useState<Record<string, KillSwitch>>({});
  const [activeKS, setActiveKS] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAlert, setNewAlert] = useState({ name: '', channel: 'in_app', target: '', priority: 'medium' });
  const [ksApi, setKsApi] = useState('');
  const [ksReason, setKsReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [cfgData, ksData] = await Promise.all([
        apiClient.getAlertConfigs(),
        apiClient.getKillSwitches(),
      ]);
      setConfigs(cfgData.configs || []);
      setKillSwitches(ksData.kill_switches || {});
      setActiveKS(ksData.active || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newAlert.name) return;
    await apiClient.createAlertConfig(newAlert);
    setShowCreate(false);
    setNewAlert({ name: '', channel: 'in_app', target: '', priority: 'medium' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await apiClient.deleteAlertConfig(id);
    fetchData();
  };

  const handleActivateKS = async () => {
    if (!ksApi) return;
    await apiClient.activateKillSwitch(ksApi, ksReason);
    setKsApi('');
    setKsReason('');
    fetchData();
  };

  const handleDeactivateKS = async (api: string) => {
    await apiClient.deactivateKillSwitch(api);
    fetchData();
  };

  const channelIcon = (c: string) => {
    const map: Record<string, string> = { webhook: '🔗', email: '📧', in_app: '🔔', slack: '💬' };
    return map[c] || '📢';
  };

  const priorityVariant = (p: string): 'danger' | 'warning' | 'info' | 'default' => {
    if (p === 'critical') return 'danger';
    if (p === 'high') return 'warning';
    if (p === 'medium') return 'info';
    return 'default';
  };

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Alerts & Kill-Switch"
        subtitle="Alert configuration and emergency controls"
        icon={
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        badge={activeKS.length > 0 ? { label: `${activeKS.length} active`, variant: 'danger' } : undefined}
      />

      <div className="space-y-5">
        {/* Kill-Switch Section */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
          <h3 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Kill-Switch
            {activeKS.length > 0 && <Badge variant="danger" dot>{activeKS.length} active</Badge>}
          </h3>
          
          {activeKS.length > 0 && (
            <div className="space-y-2 mb-3">
              {activeKS.map((api) => (
                <div key={api} className="flex items-center justify-between p-2.5 bg-red-500/10 border border-red-500/10 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-red-300">{api}</span>
                    {killSwitches[api]?.reason && <span className="text-xs text-zinc-500 ml-2">— {killSwitches[api].reason}</span>}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleDeactivateKS(api)}>
                    Reactivate
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input value={ksApi} onChange={(e) => setKsApi(e.target.value)} placeholder="API name to kill..."
              className="flex-1 bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            <input value={ksReason} onChange={(e) => setKsReason(e.target.value)} placeholder="Reason"
              className="flex-1 bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            <Button variant="danger" size="sm" onClick={handleActivateKS} disabled={!ksApi}>
              KILL
            </Button>
          </div>
        </div>

        {/* Alert Configs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Alert Configurations</h3>
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(!showCreate)}>
              + New Alert
            </Button>
          </div>

          {showCreate && (
            <div className="bg-zinc-800/30 rounded-xl p-4 mb-3 border border-zinc-700/30 space-y-2">
              <input value={newAlert.name} onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })} placeholder="Alert name"
                className="w-full bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
              <div className="flex gap-2">
                <select value={newAlert.channel} onChange={(e) => setNewAlert({ ...newAlert, channel: e.target.value })}
                  className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                  <option value="in_app">In-App</option>
                  <option value="webhook">Webhook</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                </select>
                <input value={newAlert.target} onChange={(e) => setNewAlert({ ...newAlert, target: e.target.value })} placeholder="Target URL/Email"
                  className="flex-1 bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                <select value={newAlert.priority} onChange={(e) => setNewAlert({ ...newAlert, priority: e.target.value })}
                  className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <Button size="sm" onClick={handleCreate}>Save</Button>
              </div>
            </div>
          )}

          {configs.length === 0 ? (
            <EmptyState
              icon={<svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
              title="No alert configs"
              description="Create an alert configuration to get notified."
            />
          ) : (
            <div className="space-y-2">
              {configs.map((cfg) => (
                <div key={cfg.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/30 hover:border-zinc-600/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{channelIcon(cfg.channel)}</span>
                    <div>
                      <span className="text-sm font-medium text-white">{cfg.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={priorityVariant(cfg.priority)} dot>{cfg.priority}</Badge>
                        {cfg.target && <span className="text-[10px] text-zinc-500">→ {cfg.target.slice(0, 30)}</span>}
                        {cfg.trigger_count > 0 && <span className="text-[10px] text-zinc-500">• {cfg.trigger_count} triggers</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(cfg.id)} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
