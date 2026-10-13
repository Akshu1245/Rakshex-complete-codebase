'use client';
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function OpenAPIImport() {
  const [url, setUrl] = useState('');
  const [protocol, setProtocol] = useState('rest');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [customApis, setCustomApis] = useState<Record<string, unknown>[]>([]);
  const [showApis, setShowApis] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) { setError('Please enter an OpenAPI spec URL'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiClient.importOpenAPI({ url, protocol });
      if (res.status === 'success') {
        setResult(res);
        loadApis();
      } else {
        setError('Failed to import. Check the URL and try again.');
      }
    } catch { setError('Import failed'); }
    setLoading(false);
  };

  const loadApis = async () => {
    try {
      const res = await apiClient.getCustomApis();
      setCustomApis(res.apis || []);
    } catch {}
  };

  const handleDelete = async (id: number) => {
    await apiClient.deleteCustomApi(id);
    loadApis();
  };

  return (
    <Card>
      <CardHeader
        title="OpenAPI Import"
        subtitle="Import API specs from Swagger, OpenAPI, or custom URLs"
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          placeholder="https://petstore.swagger.io/v2/swagger.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <select
          className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
        >
          <option value="rest">REST</option>
          <option value="graphql">GraphQL</option>
          <option value="grpc">gRPC</option>
          <option value="websocket">WebSocket</option>
        </select>
        <Button onClick={handleImport} disabled={loading} loading={loading}>
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3 bg-red-500/5 border border-red-500/20 rounded-xl p-2.5">{error}</p>}

      {result && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-3">
          <p className="text-sm text-emerald-400 font-semibold">{result.api_name as string}</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2.5 bg-zinc-800/40 rounded-xl border border-zinc-700/30">
              <p className="text-lg font-bold text-white tabular-nums">{result.endpoint_count as number}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Endpoints</p>
            </div>
            <div className="text-center p-2.5 bg-zinc-800/40 rounded-xl border border-zinc-700/30">
              <p className="text-sm font-medium text-white truncate">{(result.version || '—') as string}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Version</p>
            </div>
            <div className="text-center p-2.5 bg-zinc-800/40 rounded-xl border border-zinc-700/30">
              <p className="text-sm font-medium text-white">{(result.protocol || 'rest') as string}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Protocol</p>
            </div>
          </div>
          {Array.isArray(result.paths) && (result.paths as string[]).length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Paths</p>
              <div className="flex flex-wrap gap-1">
                {(result.paths as string[]).slice(0, 8).map((p, i) => (
                  <span key={i} className="text-[10px] bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-lg font-mono border border-zinc-700/30">{p}</span>
                ))}
                {(result.paths as string[]).length > 8 && (
                  <span className="text-[10px] text-zinc-500">+{(result.paths as string[]).length - 8} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={() => { setShowApis(!showApis); if (!showApis) loadApis(); }}
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
        <svg className={`w-3 h-3 transition-transform ${showApis ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {showApis ? 'Hide' : 'Show'} imported APIs
      </button>

      {showApis && customApis.length > 0 && (
        <div className="mt-2 space-y-1">
          {customApis.map((api, i) => (
            <div key={i} className="flex items-center justify-between bg-zinc-800/20 border border-zinc-700/30 rounded-xl px-3 py-2">
              <div>
                <span className="text-sm text-white font-medium">{api.name as string}</span>
                <span className="text-[10px] text-zinc-500 ml-2 uppercase">{api.protocol as string}</span>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(api.id as number)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
      {showApis && customApis.length === 0 && <p className="text-xs text-zinc-500 mt-2">No imported APIs yet</p>}
    </Card>
  );
}
