'use client';

import { useState } from 'react';
import { apiClient, CompatibilityResult } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

const AVAILABLE_APIS = [
  'OpenWeatherMap', 'NASA', 'GitHub', 'Twitter', 'Stripe',
  'Twilio', 'SendGrid', 'Spotify', 'Google Maps', 'CoinGecko',
  'Reddit', 'Slack', 'Discord', 'NewsAPI', 'OpenAI'
];

export default function CompatibilityChecker() {
  const [sourceApi, setSourceApi] = useState('');
  const [targetApi, setTargetApi] = useState('');
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!sourceApi || !targetApi) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.checkCompatibility(sourceApi, targetApi);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check compatibility');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="API Compatibility Checker"
        subtitle="Verify integration compatibility between APIs"
        icon={
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Source API</label>
          <select value={sourceApi} onChange={(e) => setSourceApi(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-sm">
            <option value="">Select API...</option>
            {AVAILABLE_APIS.map(api => <option key={api} value={api}>{api}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Target API</label>
          <select value={targetApi} onChange={(e) => setTargetApi(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-sm">
            <option value="">Select API...</option>
            {AVAILABLE_APIS.map(api => <option key={api} value={api}>{api}</option>)}
          </select>
        </div>
      </div>

      <Button onClick={handleCheck} disabled={loading || !sourceApi || !targetApi} loading={loading} className="w-full">
        {loading ? 'Analyzing...' : 'Check Compatibility'}
      </Button>

      {error && (
        <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className={`p-4 rounded-xl border ${
            result.compatible ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                result.compatible ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                {result.compatible ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              <div>
                <Badge variant={result.compatible ? 'success' : 'danger'} dot>
                  {result.compatible ? 'Compatible' : 'Not Compatible'}
                </Badge>
                <p className="text-sm text-zinc-400 mt-1">{result.message}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{result.score}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Score</div>
            </div>
            <div className="flex-1 h-2 bg-zinc-800/60 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  result.score >= 80 ? 'bg-emerald-500' :
                  result.score >= 60 ? 'bg-yellow-500' :
                  result.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${result.score}%` }}
              />
            </div>
          </div>

          {result.path.length > 0 && (
            <div className="bg-zinc-800/20 rounded-xl p-4 border border-zinc-700/30">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Integration Path</div>
              <div className="flex items-center gap-2 flex-wrap">
                {result.path.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-zinc-800/60 text-white rounded-lg text-sm border border-zinc-700/30">{step}</span>
                    {index < result.path.length - 1 && (
                      <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
