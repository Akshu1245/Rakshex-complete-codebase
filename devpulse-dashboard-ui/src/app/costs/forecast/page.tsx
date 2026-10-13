import BudgetForecast from '@/components/BudgetForecast';

export default function ForecastPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Cost Forecast</h1>
        <p className="text-sm text-zinc-500 mt-1">30-day spend forecasting with weighted moving average analysis.</p>
      </div>

      <BudgetForecast />
    </div>
  );
}
