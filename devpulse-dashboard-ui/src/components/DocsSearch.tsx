'use client';

import { useState } from 'react';
import { apiClient, DocsResult } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function DocsSearch() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<DocsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!question.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.searchDocs(question);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search docs');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const statusVariant = (s: string): 'success' | 'warning' | 'danger' => {
    if (s === 'success') return 'success';
    if (s === 'fallback') return 'warning';
    return 'danger';
  };

  return (
    <Card>
      <CardHeader
        title="Documentation Search"
        subtitle="Ask about APIs, rate limits, authentication"
        icon={
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
      />

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about APIs, rate limits, authentication..."
            className="flex-1 px-4 py-2 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-sm"
          />
          <Button onClick={handleSearch} disabled={loading || !question.trim()} loading={loading}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Badge variant={statusVariant(result.status)} dot>{result.status.toUpperCase()}</Badge>

            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{result.summary}</p>
            </div>

            {result.sources.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((source, index) => (
                    <a key={index} href={source} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-blue-400 text-xs rounded-lg transition-colors flex items-center gap-1.5 border border-zinc-700/30">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {new URL(source).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
