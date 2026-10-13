'use client';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ReportsExport() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [exportResult, setExportResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getReportSummary();
        if (res.summary) setSummary(res.summary as Record<string, unknown>);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}-${format}`);
    try {
      if (format === 'csv') {
        const res = await fetch(`http://localhost:8000/api/reports/export?report_type=${type}&format=csv&days=30`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `devpulse_${type}_report.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const res = await apiClient.exportReport(type, 'json', 30);
        setExportResult(res);
      }
    } catch {}
    setExporting('');
  };

  const reportTypes = [
    { key: 'analytics', label: 'Analytics', icon: <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, desc: 'Usage trends & API call data' },
    { key: 'health', label: 'Health', icon: <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>, desc: 'API health & latency data' },
    { key: 'security', label: 'Security', icon: <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>, desc: 'Vulnerability scan results' },
    { key: 'incidents', label: 'Incidents', icon: <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>, desc: 'Incident history & timeline' },
  ];

  const summaryData = summary as Record<string, Record<string, unknown>> | null;

  if (loading) return <CardSkeleton rows={4} />;

  return (
    <Card>
      <CardHeader
        title="Reports & Export"
        subtitle="Download reports in JSON or CSV format"
        icon={
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      {/* Summary Cards */}
      {summaryData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {summaryData.health && (
            <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{summaryData.health.healthy as number}/{summaryData.health.total_apis as number}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">APIs Healthy</p>
            </div>
          )}
          {summaryData.usage_7d && (
            <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-violet-400 tabular-nums">{(summaryData.usage_7d.total_calls as number) || 0}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Calls (7d)</p>
            </div>
          )}
          <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{Number(summaryData.recent_scans || 0)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Recent Scans</p>
          </div>
          <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-400 tabular-nums">{Number(summaryData.active_incidents || 0)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Active Incidents</p>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reportTypes.map((rt) => (
          <div key={rt.key} className="bg-zinc-800/20 border border-zinc-700/30 rounded-xl p-4 hover:border-zinc-600/50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              {rt.icon}
              <div>
                <p className="text-sm text-white font-semibold">{rt.label}</p>
                <p className="text-[10px] text-zinc-500">{rt.desc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => handleExport(rt.key, 'json')} disabled={!!exporting} loading={exporting === `${rt.key}-json`} className="flex-1">
                JSON
              </Button>
              <Button size="sm" onClick={() => handleExport(rt.key, 'csv')} disabled={!!exporting} loading={exporting === `${rt.key}-csv`} className="flex-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                CSV
              </Button>
            </div>
          </div>
        ))}
      </div>

      {exportResult && (
        <div className="mt-4 bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Export Result</p>
            <button onClick={() => setExportResult(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <pre className="text-[10px] text-zinc-400 overflow-auto max-h-40 font-mono bg-zinc-950 rounded-xl p-3 border border-zinc-800">
            {JSON.stringify(exportResult, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
