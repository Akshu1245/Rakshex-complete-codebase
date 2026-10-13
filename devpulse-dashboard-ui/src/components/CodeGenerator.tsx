'use client';

import { useState, useMemo } from 'react';
import { apiClient, GenerateResult } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

const LANGUAGES = [
  { value: 'python', label: 'Python', icon: 'PY' },
  { value: 'javascript', label: 'JavaScript', icon: 'JS' },
  { value: 'typescript', label: 'TypeScript', icon: 'TS' },
  { value: 'java', label: 'Java', icon: 'JV' },
  { value: 'go', label: 'Go', icon: 'GO' },
  { value: 'rust', label: 'Rust', icon: 'RS' },
];

// Lightweight keyword-based syntax highlighting
function highlightCode(code: string, language: string): string {
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escaped = escapeHtml(code);

  const keywords: Record<string, string[]> = {
    python: ['import', 'from', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'async', 'await', 'raise', 'pass', 'break', 'continue', 'yield', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'self'],
    javascript: ['import', 'from', 'export', 'default', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'async', 'await', 'throw', 'new', 'class', 'extends', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof'],
    typescript: ['import', 'from', 'export', 'default', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'async', 'await', 'throw', 'new', 'class', 'extends', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected', 'readonly'],
    java: ['import', 'package', 'class', 'public', 'private', 'protected', 'static', 'final', 'void', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'extends', 'implements', 'this', 'super', 'true', 'false', 'null', 'interface', 'abstract', 'synchronized'],
    go: ['package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'go', 'defer', 'chan', 'select', 'struct', 'interface', 'map', 'type', 'var', 'const', 'true', 'false', 'nil', 'make', 'append', 'len', 'cap', 'error'],
    rust: ['use', 'mod', 'pub', 'fn', 'let', 'mut', 'const', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'impl', 'struct', 'enum', 'trait', 'where', 'async', 'await', 'self', 'Self', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Result', 'Option', 'Vec', 'String', 'Box', 'Arc', 'Rc', 'unsafe', 'move'],
  };

  const kws = keywords[language] || keywords.python;
  let result = escaped;

  // Strings (double and single quoted)
  result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span style="color:#a5d6a7">$&</span>');
  // Comments (// and #)
  result = result.replace(/(\/\/.*$|#.*$)/gm, '<span style="color:#6b7280;font-style:italic">$&</span>');
  // Numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#f0abfc">$&</span>');
  // Keywords
  const kwPattern = new RegExp(`\\b(${kws.join('|')})\\b`, 'g');
  result = result.replace(kwPattern, '<span style="color:#c084fc;font-weight:600">$&</span>');
  // Function calls
  result = result.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span style="color:#93c5fd">$&</span>');

  return result;
}

export default function CodeGenerator() {
  const [useCase, setUseCase] = useState('');
  const [language, setLanguage] = useState('python');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!useCase.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.generateCode(useCase, language);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadCode = () => {
    if (!result?.code) return;
    const ext: Record<string, string> = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', go: 'go', rust: 'rs' };
    const blob = new Blob([result.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devpulse_generated.${ext[language] || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highlightedCode = useMemo(() => {
    if (!result?.code) return '';
    return highlightCode(result.code, result.language || language);
  }, [result, language]);

  const lineCount = result?.code ? result.code.split('\n').length : 0;

  return (
    <Card>
      <CardHeader
        title="AI Code Generator"
        subtitle="Generate production-ready API integration code"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />

      <div className="space-y-4">
        {/* Language Selector */}
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                language === lang.value
                  ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                  : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <span className="mr-1 text-[10px] font-bold opacity-60">{lang.icon}</span> {lang.label}
            </button>
          ))}
        </div>

        {/* Prompt Input */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Describe your integration use case
          </label>
          <textarea
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="e.g., Build a weather dashboard that fetches data from OpenWeatherMap and displays alerts"
            className="w-full h-24 px-4 py-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
            maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-500">{useCase.length}/500 &middot; Ctrl+Enter to generate</span>
            <Button onClick={handleGenerate} disabled={loading || !useCase.trim()} loading={loading}>
              {loading ? 'Generating...' : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate {LANGUAGES.find((l) => l.value === language)?.label} Code
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Status & Validation Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={result.status === 'success' ? 'success' : result.status === 'fallback' ? 'warning' : 'danger'} dot>
                {result.status.toUpperCase()}
              </Badge>
              <Badge variant="purple">{(result.language || language).toUpperCase()}</Badge>
              {result.apis_used.length > 0 && (
                <Badge variant="info">{result.apis_used.join(', ')}</Badge>
              )}
              {result.tokens_used > 0 && (
                <Badge variant="default">{result.tokens_used} tokens</Badge>
              )}
              {result.auto_repaired && (
                <Badge variant="info">Auto-Repaired</Badge>
              )}
              {result.validation && (
                <Badge variant={result.validation.grade === 'A' ? 'success' : result.validation.grade === 'B' ? 'info' : result.validation.grade === 'C' ? 'warning' : 'danger'}>
                  Grade: {result.validation.grade} ({result.validation.score}%)
                </Badge>
              )}
            </div>

            {/* Validation Details */}
            {result.validation && (
              <div className="bg-zinc-800/20 rounded-xl p-4 space-y-2 border border-zinc-700/30">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-400">✓ {result.validation.passed_checks.length} passed</span>
                  <span className="text-red-400">✗ {result.validation.failed_checks.length} failed</span>
                </div>
                {result.validation.suggestions.length > 0 && (
                  <div className="text-xs text-zinc-400">
                    <strong>Suggestions:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {result.validation.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Code Output with Syntax Highlighting */}
            {result.code ? (
              <div className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                    </div>
                    <span className="text-xs text-zinc-500 ml-2">
                      {(result.language || language)} &middot; {lineCount} lines
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadCode}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs rounded-md transition-colors"
                    >
                      Download
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs rounded-md transition-colors"
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                {/* Code with Line Numbers */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <tbody>
                      {result.code.split('\n').map((_, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30">
                          <td className="px-3 py-0 text-right select-none text-xs text-zinc-600 w-10 align-top sticky left-0 bg-zinc-950">
                            {i + 1}
                          </td>
                          <td className="px-4 py-0">
                            <pre className="text-sm leading-6">
                              <code dangerouslySetInnerHTML={{ __html: highlightedCode.split('\n')[i] || '' }} />
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : result.message ? (
              <div className="bg-zinc-800/30 rounded-xl p-4 text-zinc-400 border border-zinc-700/30">{result.message}</div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
