import SecurityScoreCard from '@/components/SecurityScoreCard';
import ThreatFeed from '@/components/ThreatFeed';
import AIFixSuggestion from '@/components/AIFixSuggestion';
import ApiInventory from '@/components/ApiInventory';
import SecurityReport from '@/components/SecurityReport';

export default function SecurityPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Security Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">AI-powered API security scanning, threat detection, and fix suggestions.</p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityScoreCard />
        <ThreatFeed />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIFixSuggestion />
        <ApiInventory />
      </section>

      <section>
        <SecurityReport />
      </section>
    </div>
  );
}
