'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CICDPanel() {
  const [pipelineId, setPipelineId] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [codeToScan, setCodeToScan] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!pipelineId.trim()) return;
    setLoading(true);
    try {
      const data = await apiClient.cicdCheck({
        code: codeToScan || 'print("hello")',
        pipeline_id: pipelineId,
        repo, branch,
        language: 'python',
      });
      setResult(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const passed = result?.passed === true;

  return (
    <Card>
      <CardHeader
        title="CI/CD Integration"
        subtitle="Security gates for your deployment pipeline"
        icon={
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} placeholder="Pipeline ID"
            className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo"
            className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch"
            className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        </div>

        <textarea value={codeToScan} onChange={(e) => setCodeToScan(e.target.value)} rows={3}
          placeholder="Optional: paste code to include in security scan..."
          className="w-full bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl p-3 font-mono text-sm resize-y placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />

        <Button onClick={handleCheck} disabled={loading || !pipelineId.trim()} loading={loading} className="w-full">
          {loading ? 'Running Pipeline Check...' : 'Run DevPulse Gate Check'}
        </Button>
      </div>

      {result && (
        <div className={`mt-5 p-4 rounded-xl border ${passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${passed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {passed ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              <span className={`text-lg font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <span className="text-xs text-zinc-500">{(result as Record<string, Record<string, unknown>>)?.details?.timestamp as string || ''}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className={`p-2.5 rounded-xl text-center border ${Number(result?.security_score || 0) >= 70 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Score</div>
              <div className="font-bold tabular-nums">{result?.security_score as number || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center border border-zinc-700/30 bg-zinc-800/30 text-zinc-300">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Grade</div>
              <div className="font-bold">{result?.grade as string || '?'}</div>
            </div>
            <div className={`p-2.5 rounded-xl text-center border ${Number(result?.vulnerabilities_found || 0) === 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-400'}`}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Vulns</div>
              <div className="font-bold tabular-nums">{result?.vulnerabilities_found as number || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Example */}
      <div className="mt-5 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
        <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">GitHub Actions Example</h3>
        <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">{`- name: DevPulse Gate Check
  run: |
    curl -X POST http://your-server:8000/api/cicd/check \\
      -H "Content-Type: application/json" \\
      -d '{"pipeline_id":"$\{GITHUB_RUN_ID}","repo":"$\{GITHUB_REPOSITORY}","branch":"$\{GITHUB_REF_NAME}"}'`}</pre>
      </div>
    </Card>
  );
}
