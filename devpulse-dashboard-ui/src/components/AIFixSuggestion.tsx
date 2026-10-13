'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

interface Suggestion {
  rule_id: string;
  severity: string;
  title: string;
  description: string;
  fix_recommendation: string;
  fix_code?: string;
  explanation?: string;
  ai_generated: boolean;
  line?: number;
}

export default function AIFixSuggestion() {
  const [code, setCode] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const getSuggestions = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const scanRes = await fetch(`${API}/api/v1/security/scan/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, language: 'python' }),
      });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        const fixRes = await fetch(`${API}/api/v1/security/fix-suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            code,
            findings: scanData.all_findings || [],
          }),
        });
        if (fixRes.ok) {
          const fixData = await fixRes.json();
          setSuggestions(fixData.suggestions || []);
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const sevVariant = (s: string): 'danger' | 'warning' | 'info' => {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    return 'info';
  };

  return (
    <Card>
      <CardHeader
        title="AI Fix Suggestions"
        subtitle="Get AI-powered remediation for security issues"
        icon={
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        }
        badge={suggestions.length > 0 ? { label: `${suggestions.length} suggestions`, variant: 'warning' } : undefined}
      />

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste code to get AI-powered fix suggestions..."
        className="w-full h-28 bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3 text-sm text-zinc-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-zinc-600 mb-4"
      />
      <Button onClick={getSuggestions} disabled={loading || !code.trim()} loading={loading} className="w-full mb-4">
        {loading ? 'Analyzing...' : 'Get Fix Suggestions'}
      </Button>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="bg-zinc-800/20 border border-zinc-700/30 rounded-xl p-4 cursor-pointer hover:border-zinc-600/50 transition-colors"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={sevVariant(s.severity)} dot>{s.severity}</Badge>
                    {s.ai_generated && <Badge variant="purple">AI</Badge>}
                    {s.line && <span className="text-[10px] text-zinc-600 tabular-nums">Line {s.line}</span>}
                  </div>
                  <h4 className="text-sm font-semibold text-white">{s.title}</h4>
                </div>
                <svg className={`w-4 h-4 text-zinc-500 transition-transform ${expandedIdx === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {expandedIdx === i && (
                <div className="mt-3 pt-3 border-t border-zinc-700/30 space-y-2">
                  <p className="text-xs text-zinc-400 leading-relaxed">{s.description}</p>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Recommended Fix</p>
                    <p className="text-xs text-zinc-300">{s.fix_recommendation}</p>
                  </div>
                  {s.fix_code && (
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-emerald-300 font-mono overflow-x-auto">
                      {s.fix_code}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
