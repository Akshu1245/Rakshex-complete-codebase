import CostIntelligenceDashboard from '@/components/CostIntelligenceDashboard';
import ROICalculator from '@/components/ROICalculator';

export default function CostsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Cost Intelligence</h1>
        <p className="text-sm text-zinc-500 mt-1">Track, forecast, and optimize your API spending across all providers.</p>
      </div>

      <CostIntelligenceDashboard />

      <section>
        <ROICalculator />
      </section>
    </div>
  );
}
