'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Shared';

interface ScanResult {
  score: number;
  grade: string;
  total_threats: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

interface ScoreHistory {
  scan_id: number;
  score: number;
  grade: string;
  threats_found: number;
  scan_type: string;
  scanned_at: string;
}

export default function SecurityScoreCard() {
  const [score, setScore] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/v1/security/score-history?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchHistory(); }, []);

  const runScan = async () => {
    if (!code.trim()) return;
    setScanning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/v1/security/scan/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, language: 'python' }),
      });
      if (res.ok) {
        const data = await res.json();
        setScore(data);
        fetchHistory();
      }
    } catch { /* ignore */ }
    setScanning(false);
  };

  const gradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-400';
    if (grade === 'B') return 'text-amber-400';
    if (grade === 'C') return 'text-orange-400';
    return 'text-red-400';
  };

  const gradeBg = (grade: string) => {
    if (grade.startsWith('A')) return 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20';
    if (grade === 'B') return 'from-amber-500/20 to-amber-500/5 border-amber-500/20';
    if (grade === 'C') return 'from-orange-500/20 to-orange-500/5 border-orange-500/20';
    return 'from-red-500/20 to-red-500/5 border-red-500/20';
  };

  return (
    <Card>
      <CardHeader
        title="Security Score"
        subtitle="AI-powered security analysis for your API code"
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
        badge={score ? { label: `Grade ${score.grade}`, variant: score.grade.startsWith('A') ? 'success' : score.grade === 'B' ? 'warning' : 'danger' } : undefined}
      />

      {/* Score display */}
      {score && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className={`bg-gradient-to-b ${gradeBg(score.grade)} rounded-xl p-4 border text-center`}>
            <div className={`text-3xl font-black tracking-tight ${gradeColor(score.grade)}`}>{score.grade}</div>
            <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-medium">Grade</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
            <div className="text-3xl font-black tracking-tight text-zinc-100">{score.score}</div>
            <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-medium">Score / 100</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
            <div className="text-3xl font-black tracking-tight text-red-400">{score.critical_count}</div>
            <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-medium">Critical</div>
          </div>
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
            <div className="text-3xl font-black tracking-tight text-orange-400">{score.total_threats}</div>
            <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-medium">Total Issues</div>
          </div>
        </div>
      )}

      {/* Code input */}
      <div className="space-y-3">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your API code here for security analysis..."
          className="w-full h-32 bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4 text-sm text-zinc-300 font-mono resize-none placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-all"
        />
        <Button
          onClick={runScan}
          disabled={scanning || !code.trim()}
          loading={scanning}
          className="w-full"
          icon={
            !scanning ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ) : undefined
          }
        >
          {scanning ? 'Analyzing...' : 'Run Security Scan'}
        </Button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-6 pt-5 border-t border-zinc-800/60">
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent Scans</h4>
          <div className="space-y-1.5">
            {history.slice(0, 5).map((h) => (
              <div key={h.scan_id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${gradeColor(h.grade)}`}>{h.grade}</span>
                  <Badge variant="default">{h.scan_type}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{h.threats_found} issues</span>
                  <span className="text-[11px] text-zinc-600">{h.scanned_at.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
