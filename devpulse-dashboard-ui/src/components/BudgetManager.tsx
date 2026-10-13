'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, type BudgetSummary, type ApiKeyInfo } from '@/lib/api';

// ─── Sub-components ──────────────────────────────────────────────────────────

function BudgetBar({ used, limit, label }: { used: number; limit: number | null; label?: string }) {
  if (!limit || limit <= 0) {
    return (
      <div className="space-y-1">
        {label && <span className="text-xs text-zinc-500">{label}</span>}
        <div className="h-2 rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-zinc-600 w-0" />
        </div>
        <span className="text-xs text-zinc-500">No limit set</span>
      </div>
    );
  }
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      {label && <span className="text-xs text-zinc-500">{label}</span>}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>${used.toFixed(2)} used</span>
        <span>${limit.toFixed(2)} limit</span>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Add Key Modal ───────────────────────────────────────────────────────────

function AddKeyModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [form, setForm] = useState({
    key_name: '',
    api_provider: 'xai',
    api_key: '',
    budget_limit: '',
    budget_period: 'monthly',
    call_limit: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.addApiKey({
        key_name: form.key_name,
        api_provider: form.api_provider,
        api_key: form.api_key,
        budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : null,
        budget_period: form.budget_period,
        call_limit: form.call_limit ? parseInt(form.call_limit) : null,
      });
      if (res.status === 'success') {
        onAdd();
        onClose();
      } else {
        setError(res.message || 'Failed to add key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Add API Key</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">&times;</button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Key Name</label>
              <input
                type="text"
                required
                value={form.key_name}
                onChange={(e) => setForm({ ...form, key_name: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                placeholder="My xAI Key"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Provider</label>
              <select
                value={form.api_provider}
                onChange={(e) => setForm({ ...form, api_provider: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="xai">xAI (Grok)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google AI</option>
                <option value="groq">Groq</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">API Key</label>
            <input
              type="password"
              required
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono"
              placeholder="sk-..."
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Budget Limit ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.budget_limit}
                onChange={(e) => setForm({ ...form, budget_limit: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                placeholder="50.00"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Period</label>
              <select
                value={form.budget_period}
                onChange={(e) => setForm({ ...form, budget_period: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Call Limit</label>
              <input
                type="number"
                min="0"
                value={form.call_limit}
                onChange={(e) => setForm({ ...form, call_limit: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                placeholder="1000"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2.5 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              {loading ? 'Adding...' : 'Add Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Key Modal ──────────────────────────────────────────────────────────

function EditKeyModal({ keyInfo, onClose, onSave }: { keyInfo: ApiKeyInfo; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    key_name: keyInfo.key_name,
    budget_limit: keyInfo.budget_limit?.toString() || '',
    budget_period: keyInfo.budget_period || 'monthly',
    call_limit: keyInfo.call_limit?.toString() || '',
    is_active: keyInfo.is_active,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.updateApiKey(keyInfo.id, {
        key_name: form.key_name,
        budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : null,
        budget_period: form.budget_period,
        call_limit: form.call_limit ? parseInt(form.call_limit) : null,
        is_active: form.is_active,
      });
      onSave();
      onClose();
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Edit: {keyInfo.key_name}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Key Name</label>
            <input
              type="text"
              value={form.key_name}
              onChange={(e) => setForm({ ...form, key_name: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Budget Limit ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.budget_limit}
                onChange={(e) => setForm({ ...form, budget_limit: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="50.00"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Period</label>
              <select
                value={form.budget_period}
                onChange={(e) => setForm({ ...form, budget_period: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Call Limit</label>
              <input
                type="number"
                min="0"
                value={form.call_limit}
                onChange={(e) => setForm({ ...form, call_limit: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none"
                placeholder="1000"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
            <span className="text-sm text-zinc-300">Active</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2.5 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Overall Budget Modal ────────────────────────────────────────────────────

function OverallBudgetModal({ current, onClose, onSave }: { current: BudgetSummary['overall']; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    budget_limit: current.budget_limit?.toString() || '',
    alert_threshold: current.alert_threshold?.toString() || '80',
    budget_period: current.budget_period || 'monthly',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.setOverallBudget({
        budget_limit: parseFloat(form.budget_limit),
        alert_threshold: parseFloat(form.alert_threshold),
        budget_period: form.budget_period,
      });
      onSave();
      onClose();
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Overall Budget</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Budget Limit ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.budget_limit}
              onChange={(e) => setForm({ ...form, budget_limit: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none"
              placeholder="200.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Alert Threshold (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.alert_threshold}
                onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Period</label>
              <select
                value={form.budget_period}
                onChange={(e) => setForm({ ...form, budget_period: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2.5 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              {loading ? 'Saving...' : 'Set Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Key Row ─────────────────────────────────────────────────────────────────

function KeyRow({ k, onEdit, onDelete, onReset }: { k: ApiKeyInfo; onEdit: () => void; onDelete: () => void; onReset: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const providerColors: Record<string, string> = {
    xai: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    openai: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    anthropic: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    google: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    groq: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className={`bg-zinc-900/40 border rounded-xl p-4 transition-all ${k.is_active ? 'border-zinc-800 hover:border-zinc-700' : 'border-red-900/30 opacity-60'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${k.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <h4 className="font-medium text-white text-sm">{k.key_name}</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${providerColors[k.api_provider] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
            {k.api_provider}
          </span>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={onReset} className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Reset budget">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          {confirmDelete ? (
            <button onClick={onDelete} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
              Confirm
            </button>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-500 font-mono mb-3">{k.masked_key}</p>
      <BudgetBar used={k.budget_used} limit={k.budget_limit} label="Budget" />
      <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
        <span>{k.call_count} calls{k.call_limit ? ` / ${k.call_limit} limit` : ''}</span>
        <span>{k.budget_period}</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BudgetManager() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddKey, setShowAddKey] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyInfo | null>(null);
  const [showOverallBudget, setShowOverallBudget] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const data = await apiClient.getBudgetSummary();
      setBudget(data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleDeleteKey = async (id: number) => {
    await apiClient.deleteApiKey(id);
    fetchBudget();
  };

  const handleResetKey = async (id: number) => {
    await apiClient.resetKeyBudget(id);
    fetchBudget();
  };

  const handleResetAll = async () => {
    setResetting(true);
    await apiClient.resetBudget();
    await fetchBudget();
    setResetting(false);
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">$</span> Budget & API Keys
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 animate-pulse">
              <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
              <div className="h-8 w-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const overall = budget?.overall || { budget_limit: null, budget_used: 0, alert_threshold: 80, budget_period: 'monthly', remaining: null, usage_percent: null };
  const keys = budget?.keys || [];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">$</span> Budget & API Keys
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">AES-256 Encrypted</span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 rounded-lg transition-colors"
          >
            {resetting ? 'Resetting...' : 'Reset All'}
          </button>
          <button
            onClick={() => setShowOverallBudget(true)}
            className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-violet-400 hover:border-violet-500/30 rounded-lg transition-colors"
          >
            Set Overall Budget
          </button>
          <button
            onClick={() => setShowAddKey(true)}
            className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
          >
            + Add Key
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Overall Budget"
          value={overall.budget_limit ? `$${overall.budget_limit.toFixed(2)}` : 'No Limit'}
          sub={overall.budget_period}
          accent={overall.budget_limit ? 'text-violet-400' : 'text-zinc-400'}
        />
        <StatCard
          title="Total Spent"
          value={`$${overall.budget_used.toFixed(2)}`}
          sub={overall.remaining !== null ? `$${overall.remaining.toFixed(2)} remaining` : undefined}
          accent={overall.usage_percent && overall.usage_percent >= 90 ? 'text-red-400' : 'text-emerald-400'}
        />
        <StatCard
          title="API Keys"
          value={`${budget?.active_keys || 0} / ${budget?.total_keys || 0}`}
          sub="active / total"
        />
        <StatCard
          title="Alert Threshold"
          value={`${overall.alert_threshold}%`}
          sub="of budget limit"
          accent="text-amber-400"
        />
      </div>

      {/* Overall Budget Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <BudgetBar used={overall.budget_used} limit={overall.budget_limit} label="Overall Budget Usage" />
      </div>

      {/* API Keys Grid */}
      {keys.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900/40 border border-zinc-800 border-dashed rounded-xl">
          <p className="text-zinc-500 mb-3">No API keys added yet</p>
          <button
            onClick={() => setShowAddKey(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add Your First Key
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map((k) => (
            <KeyRow
              key={k.id}
              k={k}
              onEdit={() => setEditingKey(k)}
              onDelete={() => handleDeleteKey(k.id)}
              onReset={() => handleResetKey(k.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddKey && <AddKeyModal onClose={() => setShowAddKey(false)} onAdd={fetchBudget} />}
      {editingKey && <EditKeyModal keyInfo={editingKey} onClose={() => setEditingKey(null)} onSave={fetchBudget} />}
      {showOverallBudget && <OverallBudgetModal current={overall} onClose={() => setShowOverallBudget(false)} onSave={fetchBudget} />}
    </section>
  );
}
