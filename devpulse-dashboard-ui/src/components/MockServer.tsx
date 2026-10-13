'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

interface MockApiResponse {
  api_name: string;
  mock: boolean;
  timestamp: string;
  latency_ms: number;
  data: Record<string, unknown>;
}

export default function MockServer() {
  const [responses, setResponses] = useState<Record<string, MockApiResponse>>({});
  const [selectedApi, setSelectedApi] = useState<string>('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [offlineCode, setOfflineCode] = useState('');
  const [useCase, setUseCase] = useState('');
  const [language, setLanguage] = useState('python');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const data = await apiClient.getAllMockResponses();
      setResponses((data.apis || {}) as Record<string, MockApiResponse>);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchAll]);

  const handleSelectApi = async (name: string) => {
    setSelectedApi(name);
    try {
      const data = await apiClient.getMockResponse(name);
      setDetail(data);
    } catch { /* ignore */ }
  };

  const handleOfflineGenerate = async () => {
    if (!useCase.trim()) return;
    try {
      const data = await apiClient.mockGenerate(useCase, language);
      setOfflineCode(data.code || '');
    } catch { /* ignore */ }
  };

  const apiNames = Object.keys(responses);

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Mock Server & Offline Testing"
        subtitle="Test API integrations without real calls"
        icon={
          <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        }
        badge={{ label: `${apiNames.length} APIs`, variant: 'info' }}
      />

      {apiNames.length === 0 ? (
        <EmptyState
          icon={<svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" /></svg>}
          title="No mock APIs available"
          description="Mock responses will appear when APIs are configured."
        />
      ) : (
        <div className="space-y-4">
          {/* Mock API Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {apiNames.map((name) => (
              <button key={name} onClick={() => handleSelectApi(name)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  selectedApi === name
                    ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'}`}>
                {name}
              </button>
            ))}
          </div>

          {/* Selected API Response */}
          {detail && (
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-emerald-400">{selectedApi} — Mock Response</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">No real API calls</span>
              </div>
              <pre className="text-xs text-zinc-300 overflow-auto max-h-48 font-mono bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </div>
          )}

          {/* Offline Code Generation */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Offline Code Generation</h3>
            <div className="flex gap-2">
              <input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="Describe your use case..."
                className="flex-1 bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
              </select>
              <Button onClick={handleOfflineGenerate} size="sm">
                Generate
              </Button>
            </div>
            {offlineCode && (
              <pre className="mt-3 text-xs text-emerald-300 bg-zinc-950 rounded-xl p-3 overflow-auto max-h-48 font-mono border border-zinc-800">
                {offlineCode}
              </pre>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
