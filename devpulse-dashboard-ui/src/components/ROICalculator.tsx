'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ROICalculator() {
  const [spend, setSpend] = useState(500);
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(75);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    estimated_api_savings_usd: number;
    estimated_time_savings_usd: number;
    total_monthly_value: number;
    net_monthly_savings: number;
    roi_percentage: number;
    annual_savings: number;
    payback_days: number;
  } | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const calculateFromAPI = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/v1/costs/roi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          monthly_api_spend: spend,
          plan_cost: 29,
          estimated_savings_pct: 30,
          hours_saved_per_month: hours,
          engineer_hourly_rate: rate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const instantCalc = () => {
    const apiSavings = spend * 0.3;
    const timeSavings = hours * rate;
    const total = apiSavings + timeSavings;
    const net = total - 29;
    return {
      estimated_api_savings_usd: apiSavings,
      estimated_time_savings_usd: timeSavings,
      total_monthly_value: total,
      net_monthly_savings: net,
      roi_percentage: net > 0 ? ((total - 29) / 29) * 100 : 0,
      annual_savings: net * 12,
      payback_days: net > 0 ? 29 / (net / 30) : 999,
    };
  };

  const displayResult = result || instantCalc();

  return (
    <Card className="bg-gradient-to-br from-emerald-500/5 to-violet-500/5 border-emerald-500/20">
      <CardHeader
        title="ROI Calculator"
        subtitle="See how much DevPulse saves your team"
        icon={
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Monthly API Spend ($)</label>
          <input type="number" value={spend} onChange={(e) => setSpend(Number(e.target.value))}
            className="w-full bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Hours Saved / Month</label>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))}
            className="w-full bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Engineer Hourly Rate ($)</label>
          <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))}
            className="w-full bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        </div>
      </div>

      <Button onClick={calculateFromAPI} loading={loading} variant="secondary" className="w-full mb-4 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20">
        Calculate with API
      </Button>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 rounded-xl p-4 text-center border border-zinc-700/30">
          <div className="text-2xl font-black text-emerald-400 tabular-nums">${displayResult.net_monthly_savings.toFixed(0)}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Net Savings / mo</div>
        </div>
        <div className="bg-zinc-900/60 rounded-xl p-4 text-center border border-zinc-700/30">
          <div className="text-2xl font-black text-white tabular-nums">${displayResult.annual_savings.toFixed(0)}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Annual Savings</div>
        </div>
        <div className="bg-zinc-900/60 rounded-xl p-4 text-center border border-zinc-700/30">
          <div className="text-2xl font-black text-violet-400 tabular-nums">{displayResult.roi_percentage.toFixed(0)}%</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">ROI</div>
        </div>
        <div className="bg-zinc-900/60 rounded-xl p-4 text-center border border-zinc-700/30">
          <div className="text-2xl font-black text-blue-400 tabular-nums">
            {displayResult.payback_days < 100 ? `${displayResult.payback_days.toFixed(0)}d` : 'N/A'}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Payback Period</div>
        </div>
      </div>
    </Card>
  );
}
