'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, MarketplaceTemplate } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

export default function Marketplace() {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTpl, setSelectedTpl] = useState<MarketplaceTemplate | null>(null);
  const [installing, setInstalling] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiClient.getMarketplaceTemplates({
        search: search || undefined,
        category: category || undefined,
        language: language || undefined,
      });
      setTemplates(data.templates || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, category, language]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchTemplates();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchTemplates]);

  const handleInstall = async (id: string) => {
    setInstalling(id);
    try {
      const data = await apiClient.installTemplate(id);
      if (data.code) {
        const tpl = templates.find((t) => t.id === id);
        if (tpl) setSelectedTpl({ ...tpl, code: data.code });
      }
    } catch { /* ignore */ }
    setInstalling('');
    fetchTemplates();
  };

  const stars = (rating: number) => {
    const full = Math.floor(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  const langVariant = (l: string): 'info' | 'warning' | 'purple' | 'default' => {
    const map: Record<string, 'info' | 'warning' | 'purple' | 'default'> = { python: 'info', javascript: 'warning', typescript: 'info', go: 'info', rust: 'warning' };
    return map[l] || 'default';
  };

  if (loading) return <CardSkeleton rows={5} />;

  return (
    <Card>
      <CardHeader
        title="Community Marketplace"
        subtitle="Browse and install integration templates"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        badge={{ label: `${templates.length} templates`, variant: 'default' }}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..."
          className="flex-1 bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
          <option value="">All Categories</option>
          <option value="weather">Weather</option>
          <option value="ci-cd">CI/CD</option>
          <option value="payments">Payments</option>
          <option value="messaging">Messaging</option>
          <option value="integration">Integration</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="bg-zinc-800/40 text-zinc-300 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
          <option value="">All Languages</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
        </select>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          title="No templates found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 bg-zinc-800/20 rounded-xl border border-zinc-700/30 hover:border-zinc-600/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    {tpl.name}
                    {tpl.verified && (
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{tpl.description.slice(0, 80)}</p>
                </div>
                <Badge variant={langVariant(tpl.language)}>{tpl.language}</Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                <span className="text-yellow-400">{stars(tpl.rating)}</span>
                <span className="tabular-nums">{tpl.rating}</span>
                <span>•</span>
                <span className="tabular-nums">{tpl.downloads} downloads</span>
                <span>•</span>
                <span>{tpl.author}</span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[10px] bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-lg border border-zinc-700/30">{tag}</span>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedTpl(tpl)} className="flex-1">
                  Preview
                </Button>
                <Button size="sm" onClick={() => handleInstall(tpl.id)} disabled={installing === tpl.id} loading={installing === tpl.id} className="flex-1">
                  {installing === tpl.id ? 'Installing...' : 'Install'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {selectedTpl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTpl(null)}>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-2xl w-full max-h-[80vh] overflow-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{selectedTpl.name}</h3>
              <button onClick={() => setSelectedTpl(null)} className="text-zinc-400 hover:text-white text-xl transition-colors">&times;</button>
            </div>
            <p className="text-sm text-zinc-400 mb-2">{selectedTpl.description}</p>
            <div className="text-xs text-zinc-500 mb-4">
              APIs: {selectedTpl.apis_used.join(', ')} &middot; v{selectedTpl.version}
            </div>
            <pre className="text-xs text-zinc-300 bg-zinc-950 rounded-xl p-4 overflow-auto max-h-96 font-mono border border-zinc-800">
              {selectedTpl.code}
            </pre>
            <Button onClick={() => { handleInstall(selectedTpl.id); setSelectedTpl(null); }} className="mt-4 w-full">
              Install Template
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
