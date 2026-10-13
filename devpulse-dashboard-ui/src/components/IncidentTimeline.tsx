'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Incident, IncidentStats } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function IncidentTimeline() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newInc, setNewInc] = useState({ api_name: '', title: '', severity: 'medium', description: '' });

  const fetchData = useCallback(async () => {
    try {
      const [incData, statsData] = await Promise.all([
        apiClient.getIncidents(50, filter || undefined),
        apiClient.getIncidentStats(),
      ]);
      setIncidents(incData.incidents || []);
      setStats(statsData);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchData();
    }, 0);
    const intervalId = setInterval(() => {
      void fetchData();
    }, 30000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newInc.api_name || !newInc.title) return;
    await apiClient.createIncident(newInc);
    setShowCreate(false);
    setNewInc({ api_name: '', title: '', severity: 'medium', description: '' });
    fetchData();
  };

  const handleResolve = async (id: string) => {
    await apiClient.resolveIncident(id, { resolution: 'Resolved manually' });
    fetchData();
  };

  const sevDot = (s: string) => {
    const map: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-500', info: 'bg-zinc-500' };
    return map[s] || 'bg-zinc-500';
  };

  const statusVariant = (s: string): 'danger' | 'warning' | 'info' | 'success' | 'default' => {
    const map: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
      detected: 'danger', investigating: 'warning', identified: 'warning', monitoring: 'info', resolved: 'success',
    };
    return map[s] || 'default';
  };

  if (loading) return <CardSkeleton rows={5} />;

  return (
    <Card>
      <CardHeader
        title="Incident Timeline"
        subtitle="Track and manage API incidents"
        icon={
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        }
        action={
          <Button variant="danger" size="sm" onClick={() => setShowCreate(!showCreate)}>
            + Report Incident
          </Button>
        }
      />

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
            <div className="text-2xl font-bold text-red-400 tabular-nums">{stats.active_incidents}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Active</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.resolved_incidents}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Resolved</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
            <div className="text-2xl font-bold text-yellow-400 tabular-nums">{stats.incidents_24h}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">24h</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
            <div className="text-2xl font-bold text-blue-400 tabular-nums">{stats.mttr_minutes}m</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">MTTR</div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-zinc-800/30 rounded-xl p-4 mb-4 border border-zinc-700/30 space-y-2">
          <input value={newInc.api_name} onChange={(e) => setNewInc({ ...newInc, api_name: e.target.value })} placeholder="API Name"
            className="w-full bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          <input value={newInc.title} onChange={(e) => setNewInc({ ...newInc, title: e.target.value })} placeholder="Incident Title"
            className="w-full bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          <div className="flex gap-2">
            <select value={newInc.severity} onChange={(e) => setNewInc({ ...newInc, severity: e.target.value })}
              className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button variant="danger" size="sm" onClick={handleCreate}>Create</Button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-3">
        {['', 'detected', 'investigating', 'resolved'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              filter === f
                ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
            }`}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      {incidents.length === 0 ? (
        <EmptyState
          icon={<svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>}
          title="No incidents"
          description="All systems operational — no incidents detected."
        />
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {incidents.map((inc) => (
            <div key={inc.id} className="p-4 rounded-xl border border-zinc-700/30 bg-zinc-800/20 hover:border-zinc-600/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${sevDot(inc.severity)}`} />
                  <span className="font-medium text-white text-sm">{inc.title}</span>
                </div>
                <Badge variant={statusVariant(inc.status)}>{inc.status}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                <span className="font-medium text-zinc-400">{inc.api_name}</span>
                <span>•</span>
                <span>{new Date(inc.created_at).toLocaleString()}</span>
                {inc.duration_seconds && <span>• {Math.round(inc.duration_seconds / 60)}m duration</span>}
              </div>
              {/* Mini timeline */}
              {inc.timeline.length > 0 && (
                <div className="border-l-2 border-zinc-700/50 ml-1 pl-3 space-y-1">
                  {inc.timeline.slice(-3).map((ev) => (
                    <div key={ev.id} className="text-xs text-zinc-500">
                      <span className="text-zinc-600">{new Date(ev.timestamp).toLocaleTimeString()}</span> — {ev.message}
                    </div>
                  ))}
                </div>
              )}
              {inc.status !== 'resolved' && (
                <Button variant="secondary" size="sm" onClick={() => handleResolve(inc.id)} className="mt-2">
                  Resolve
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
