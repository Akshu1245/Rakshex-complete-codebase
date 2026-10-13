'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';

interface Threat {
  id: string;
  title: string;
  severity: string;
  source: string;
  date: string;
  affected_providers: string[];
  description: string;
  mitigation: string;
}

export default function ThreatFeed() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchThreats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/v1/security/threat-feed`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setThreats(data.threats || []);
        }
      } catch { /* fallback */ }
      setLoading(false);
    };
    fetchThreats();
  }, [API]);

  const severityVariant = (severity: string): 'danger' | 'warning' | 'info' | 'purple' => {
    const map: Record<string, 'danger' | 'warning' | 'info' | 'purple'> = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'purple',
    };
    return map[severity] || 'info';
  };

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Threat Intelligence Feed"
        subtitle="Real-time AI/API security threats and advisories"
        icon={
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        }
        badge={{ label: 'LIVE', variant: 'danger' }}
      />

      {threats.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          title="No active threats"
          description="Your threat feed is clear. We're continuously monitoring for new advisories."
        />
      ) : (
        <div className="space-y-2.5">
          {threats.map((threat) => (
            <div
              key={threat.id}
              className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4 cursor-pointer hover:border-zinc-600/60 hover:bg-zinc-800/40 transition-all duration-200"
              onClick={() => setExpandedId(expandedId === threat.id ? null : threat.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant={severityVariant(threat.severity)} dot>{threat.severity}</Badge>
                    <span className="text-[11px] text-zinc-600">{threat.source}</span>
                  </div>
                  <h4 className="text-sm font-medium text-zinc-200 leading-snug">{threat.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    {threat.affected_providers.map((p) => (
                      <span key={p} className="text-[10px] bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700/30 font-medium">
                        {p}
                      </span>
                    ))}
                    <span className="text-[10px] text-zinc-600 ml-auto">{threat.date}</span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-zinc-600 shrink-0 mt-1 transition-transform duration-200 ${expandedId === threat.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {expandedId === threat.id && (
                <div className="mt-3 pt-3 border-t border-zinc-700/40 space-y-3 animate-fade-in">
                  <p className="text-xs text-zinc-400 leading-relaxed">{threat.description}</p>
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">Mitigation</p>
                    <p className="text-xs text-zinc-300 leading-relaxed">{threat.mitigation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
