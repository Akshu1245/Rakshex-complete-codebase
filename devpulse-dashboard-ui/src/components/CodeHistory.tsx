'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, type HistoryItem } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const gradeVariant = (g: string): 'success' | 'info' | 'warning' | 'danger' => {
  if (g === 'A') return 'success';
  if (g === 'B') return 'info';
  if (g === 'C') return 'warning';
  return 'danger';
};

export default function CodeHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiClient.getHistory(30);
      setHistory(data.history || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const copyCode = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Generation History"
        subtitle="Previously generated code snippets"
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        badge={{ label: `${history.length} items`, variant: 'default' }}
      />

      {history.length === 0 ? (
        <EmptyState
          icon={<svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
          title="No code generated yet"
          description="Use the Code Generator above to get started!"
        />
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-800/20 border border-zinc-700/30 rounded-xl overflow-hidden hover:border-zinc-600/50 transition-colors"
            >
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase w-6 shrink-0">{item.language.slice(0, 2).toUpperCase()}</span>
                  <span className="text-sm text-white truncate">{item.use_case}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.validation_grade && (
                    <Badge variant={gradeVariant(item.validation_grade)}>{item.validation_grade}</Badge>
                  )}
                  <span className="text-xs text-zinc-500 tabular-nums">{item.tokens_used}t</span>
                  <span className="text-xs text-zinc-600">{timeAgo(item.created_at)}</span>
                  <svg className={`w-4 h-4 text-zinc-500 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expanded === item.id && (
                <div className="border-t border-zinc-700/30">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/30">
                    <span className="text-xs text-zinc-500">{item.language} &middot; {item.apis_used?.join(', ') || 'N/A'}</span>
                    <button
                      onClick={() => copyCode(item.generated_code, item.id)}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {copied === item.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 text-sm text-zinc-300 overflow-x-auto max-h-80 bg-zinc-950 border-t border-zinc-800">
                    <code>{item.generated_code}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
