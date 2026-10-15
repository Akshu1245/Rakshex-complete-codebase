'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ProviderInfo } from '@/lib/api';
import { APIError } from '@/lib/transport';

/** Per-workspace subscription onboarding: which supported APIs this workspace depends on. */
export default function MonitoredApis({ workspaceId, canManage, onChange }: {
  workspaceId: string; canManage: boolean; onChange?: () => void;
}) {
  const [supported, setSupported] = useState<ProviderInfo[]>([]);
  const [unsupported, setUnsupported] = useState<ProviderInfo[]>([]);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<boolean | null>(null); // null = default (open when nothing selected)

  const load = useCallback(async () => {
    try {
      const [cat, s] = await Promise.all([apiClient.getProviderCatalog(), apiClient.getWorkspaceSubscriptions(workspaceId)]);
      setSupported(cat.supported); setUnsupported(cat.unsupported);
      setSubs(new Set(s.subscriptions.map(x => x.provider_id)));
      setError('');
    } catch (e) {
      setError(e instanceof APIError && e.status === 503 ? 'Monitored APIs unavailable (database migration pending).' : 'Could not load monitored APIs.');
    }
  }, [workspaceId]);

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const toggle = async (id: string, on: boolean) => {
    setBusy(id); setError('');
    const prev = subs;
    setSubs(cur => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; }); // optimistic
    try {
      if (on) await apiClient.addWorkspaceSubscription(workspaceId, id);
      else await apiClient.removeWorkspaceSubscription(workspaceId, id);
      await load(); onChange?.();
    } catch (e) {
      setSubs(prev);
      setError(e instanceof APIError && e.status === 403 ? 'Only owners and admins can change monitored APIs.' : 'Could not update monitored APIs.');
    }
    setBusy('');
  };

  return (
    <details data-testid="monitored-apis" className="mb-3 rounded-xl border border-zinc-800/60 p-3 text-xs" open={expanded ?? subs.size === 0}
      onToggle={e => setExpanded((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-zinc-300 font-medium">
        Monitored APIs ({subs.size} selected){!canManage && ' · read-only'}
      </summary>
      <p className="mt-2 text-zinc-500">
        Coverage today: the detector polls one public endpoint per API and flags changes in the JSON response shape.
        It does not read changelogs or OpenAPI specs, so many breaking changes will be missed.
      </p>
      {error && <p role="alert" data-testid="monitored-error" className="mt-2 text-red-400">{error}</p>}
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {supported.map(p => (
          <li key={p.id} className="flex items-center gap-2 min-w-0">
            <input id={`sub-${p.id}`} data-testid={`sub-${p.id}`} type="checkbox" checked={subs.has(p.id)}
              disabled={!canManage || busy === p.id} onChange={e => toggle(p.id, e.target.checked)} />
            <label htmlFor={`sub-${p.id}`} className="text-zinc-300 truncate">{p.name}</label>
            <span className="text-emerald-500/80">supported</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-zinc-500">Not supported yet (no change source):</p>
      <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="unsupported-list">
        {unsupported.map(p => (
          <li key={p.id} title={p.coverage_detail} className="px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-500">
            {p.name}: NOT SUPPORTED
          </li>
        ))}
      </ul>
    </details>
  );
}
