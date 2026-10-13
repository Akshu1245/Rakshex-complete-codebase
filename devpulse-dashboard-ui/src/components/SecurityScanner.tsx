'use client';

import { useState } from 'react';
import { apiClient, SecurityScanResult, SecurityVulnerability } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function SecurityScanner() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [result, setResult] = useState<SecurityScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const data = await apiClient.scanCode(code, language);
      setResult(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const gradeColor = (g: string) => {
    const map: Record<string, string> = { A: 'text-emerald-400', B: 'text-blue-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400' };
    return map[g] || 'text-zinc-400';
  };

  const sevVariant = (s: string): 'danger' | 'warning' | 'info' | 'default' => {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    if (s === 'low') return 'info';
    return 'default';
  };

  return (
    <Card>
      <CardHeader
        title="Security Scanner"
        subtitle="OWASP vulnerability scanning for your code"
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />

      <div className="space-y-3">
        <div className="flex gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
          <Button onClick={handleScan} disabled={loading || !code.trim()} loading={loading} size="sm">
            {loading ? 'Scanning...' : 'Scan Code'}
          </Button>
        </div>

        <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={6} placeholder="Paste code to scan for OWASP vulnerabilities..."
          className="w-full bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl p-4 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-zinc-600" />
      </div>

      {result && (
        <div className="mt-5 space-y-4">
          {/* Score Card */}
          <div className="flex items-center gap-6 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
            <div className="text-center">
              <div className={`text-4xl font-bold ${gradeColor(result.grade)}`}>{result.grade}</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mt-1">Grade</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white tabular-nums">{result.score}</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mt-1">Score / 100</div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-2 text-center text-sm">
              <div><span className="text-red-400 font-bold tabular-nums">{result.critical}</span><br /><span className="text-zinc-500 text-[10px] uppercase">Critical</span></div>
              <div><span className="text-orange-400 font-bold tabular-nums">{result.high}</span><br /><span className="text-zinc-500 text-[10px] uppercase">High</span></div>
              <div><span className="text-yellow-400 font-bold tabular-nums">{result.medium}</span><br /><span className="text-zinc-500 text-[10px] uppercase">Medium</span></div>
              <div><span className="text-blue-400 font-bold tabular-nums">{result.low}</span><br /><span className="text-zinc-500 text-[10px] uppercase">Low</span></div>
            </div>
          </div>

          {/* Vulnerabilities */}
          {result.vulnerabilities.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.vulnerabilities.map((v: SecurityVulnerability, i: number) => (
                <div key={i} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={sevVariant(v.severity)} dot>{v.severity}</Badge>
                    <span className="text-sm font-medium text-white">{v.title}</span>
                    <span className="text-[10px] text-zinc-500 ml-auto font-mono">{v.owasp_category}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{v.description}</p>
                  {v.line_number > 0 && <p className="text-xs text-zinc-500 mt-1">Line {v.line_number}: <code className="text-red-300">{v.matched_text}</code></p>}
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-400">
                    <svg className="w-3 h-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    {v.recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <h4 className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">Recommendations</h4>
              <ul className="text-xs text-zinc-300 space-y-1.5">
                {result.recommendations.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
