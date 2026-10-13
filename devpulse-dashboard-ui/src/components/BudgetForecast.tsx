'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Shared';

interface ForecastDay {
  date: string;
  predicted_usd: number;
}

interface ForecastData {
  predicted_total_usd: number;
  predicted_daily_avg_usd: number;
  confidence: number;
  trend: string;
  current_daily_avg_usd: number;
  daily_predictions: ForecastDay[];
}

export default function BudgetForecast() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/v1/costs/forecast?days_ahead=30`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setForecast(data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchForecast();
  }, [API]);

  const trendVariant = (trend: string): 'danger' | 'success' | 'warning' => {
    if (trend === 'increasing') return 'danger';
    if (trend === 'decreasing') return 'success';
    return 'warning';
  };

  const trendIcon = (trend: string) => {
    if (trend === 'increasing') return '↑';
    if (trend === 'decreasing') return '↓';
    return '→';
  };

  const trendColor = (trend: string) => {
    if (trend === 'increasing') return 'text-red-400';
    if (trend === 'decreasing') return 'text-emerald-400';
    return 'text-yellow-400';
  };

  return (
    <Card>
      <CardHeader
        title="Budget Forecast"
        subtitle="30-day cost prediction with anomaly detection"
        icon={
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        action={forecast ? <Badge variant={trendVariant(forecast.trend)} dot>{forecast.trend}</Badge> : undefined}
      />

      {loading ? (
        <CardSkeleton rows={4} />
      ) : forecast ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
              <div className="text-2xl font-black text-white tabular-nums">${forecast.predicted_total_usd.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">30-Day Forecast</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
              <div className="text-2xl font-black text-blue-400 tabular-nums">${forecast.predicted_daily_avg_usd.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Daily Avg</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
              <div className={`text-2xl font-black ${trendColor(forecast.trend)}`}>
                {trendIcon(forecast.trend)} {forecast.trend}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Trend</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 text-center">
              <div className="text-2xl font-black text-violet-400 tabular-nums">{(forecast.confidence * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Confidence</div>
            </div>
          </div>

          <div className="bg-zinc-800/20 rounded-xl p-4 border border-zinc-700/30">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Daily Predictions</div>
            <div className="flex items-end gap-0.5 h-16">
              {forecast.daily_predictions.slice(0, 30).map((day, i) => {
                const max = Math.max(...forecast.daily_predictions.map(d => d.predicted_usd));
                const height = max > 0 ? (day.predicted_usd / max) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500/60 hover:bg-blue-400/80 rounded-t transition-colors"
                    style={{ height: `${Math.max(4, height)}%` }}
                    title={`${day.date}: $${day.predicted_usd.toFixed(2)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-600">{forecast.daily_predictions[0]?.date || ''}</span>
              <span className="text-[10px] text-zinc-600">{forecast.daily_predictions[forecast.daily_predictions.length - 1]?.date || ''}</span>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          title="No Forecast Data"
          description="Cost prediction data is not yet available"
        />
      )}
    </Card>
  );
}
