import BudgetManager from '@/components/BudgetManager';

export default function BudgetPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Budget & API Keys</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage API keys, set spending limits, and track budget usage.</p>
      </div>

      <BudgetManager />
    </div>
  );
}
