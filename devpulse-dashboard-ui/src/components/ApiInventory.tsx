'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

interface ProviderUsage {
  provider: string;
  type: string;
  usage_count: number;
  locations: { line: number; snippet: string }[];
}

interface InventoryResult {
  total_providers: number;
  ai_providers: number;
  other_providers: number;
  inventory: ProviderUsage[];
}

export default function ApiInventory() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<InventoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const scanInventory = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/v1/security/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, language: 'python' }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader
        title="API Inventory"
        subtitle="Discover AI and third-party API providers in your codebase"
        icon={
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        }
      />

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste code to auto-discover API providers..."
        className="w-full h-28 bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3 text-sm text-zinc-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-zinc-600 mb-4"
      />
      <Button onClick={scanInventory} disabled={loading || !code.trim()} loading={loading} className="w-full mb-4">
        {loading ? 'Scanning...' : 'Discover APIs'}
      </Button>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-xl font-black text-white tabular-nums">{result.total_providers}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-xl font-black text-violet-400 tabular-nums">{result.ai_providers}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">AI Providers</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center border border-zinc-700/30">
              <div className="text-xl font-black text-blue-400 tabular-nums">{result.other_providers}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Other APIs</div>
            </div>
          </div>

          <div className="space-y-2">
            {result.inventory.map((item, i) => (
              <div key={i} className="bg-zinc-800/20 rounded-xl px-4 py-3 border border-zinc-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.provider}</span>
                    <Badge variant={item.type === 'ai' ? 'purple' : 'info'}>{item.type}</Badge>
                  </div>
                  <span className="text-xs text-zinc-500 tabular-nums">{item.usage_count} usage{item.usage_count !== 1 ? 's' : ''}</span>
                </div>
                {item.locations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.locations.slice(0, 3).map((loc, j) => (
                      <div key={j} className="text-[10px] text-zinc-500 font-mono truncate">
                        L{loc.line}: {loc.snippet}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
