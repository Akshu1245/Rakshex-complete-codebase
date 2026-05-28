"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export default function ROICalculator() {
  // Inputs with requested default values
  const [monthlySpend, setMonthlySpend] = useState<number>(500);
  const [agentCount, setAgentCount] = useState<number>(5);
  const [incidentCost, setIncidentCost] = useState<number>(50,000);
  const [teamSize, setTeamSize] = useState<number>(3);
  const [manualAuditHours, setManualAuditHours] = useState<number>(4);

  // Hourly engineering rate for value calculations
  const HOURLY_RATE = 80;

  // Real-time calculations based on requested formulas
  const results = useMemo(() => {
    // 1. Estimated monthly savings from cost optimization: (LLM spend × 30%)
    const monthlyCostSavings = monthlySpend * 0.30;
    const annualCostSavings = monthlyCostSavings * 12;

    // 2. Estimated annual breach risk reduction value: (incident cost × 15% probability × 12)
    const annualBreachRiskReduction = incidentCost * 0.15 * 12;

    // 3. Engineering hours saved per year: (manual audit hours × 52)
    const hoursSavedPerYear = manualAuditHours * 52;
    const valueOfHoursSaved = hoursSavedPerYear * HOURLY_RATE;

    // 4. Total annual ROI: sum of above (translating hours/monthly metrics into annual dollars)
    const totalAnnualROI = annualCostSavings + annualBreachRiskReduction + valueOfHoursSaved;

    // 5. RakshEx Pro cost: $99/mo = $1,188/yr
    const rakshexProCost = 1188;

    // 6. ROI multiplier: Total annual ROI / $1,188
    const roiMultiplier = rakshexProCost > 0 ? totalAnnualROI / rakshexProCost : 0;

    return {
      monthlyCostSavings,
      annualCostSavings,
      annualBreachRiskReduction,
      hoursSavedPerYear,
      valueOfHoursSaved,
      totalAnnualROI,
      rakshexProCost,
      roiMultiplier,
    };
  }, [monthlySpend, incidentCost, manualAuditHours]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            AI Security ROI Calculator
          </h1>
          <p className="text-slate-400 mt-2 text-base max-w-2xl">
            See how much your team can optimize LLM API usage and reduce vulnerability risk exposure with RakshEx.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Inputs Panel */}
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-900 rounded-2xl p-8 space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Calculator Inputs</h2>

            {/* Monthly LLM Spend */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-400">Monthly LLM API Spend ($)</label>
                <input
                  type="number"
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-sm text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="100"
                max="50000"
                step="100"
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>$100</span>
                <span>$50,000</span>
              </div>
            </div>

            {/* AI Agents Running */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-400">Number of AI Agents Running</label>
                <input
                  type="number"
                  value={agentCount}
                  onChange={(e) => setAgentCount(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-sm text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={agentCount}
                onChange={(e) => setAgentCount(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>1</span>
                <span>100 agents</span>
              </div>
            </div>

            {/* Average Incident Cost */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-400">Avg Incident Cost if Breach Occurs ($)</label>
                <input
                  type="number"
                  value={incidentCost}
                  onChange={(e) => setIncidentCost(Math.max(0, Number(e.target.value)))}
                  className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-sm text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="1000"
                max="500000"
                step="5000"
                value={incidentCost}
                onChange={(e) => setIncidentCost(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>$1,000</span>
                <span>$500,000</span>
              </div>
            </div>

            {/* Team Size */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-400">Team Size (Engineers)</label>
                <input
                  type="number"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-sm text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>1</span>
                <span>50 engineers</span>
              </div>
            </div>

            {/* Hours spent on audits */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-400">Hours/Week on Manual API Audits</label>
                <input
                  type="number"
                  value={manualAuditHours}
                  onChange={(e) => setManualAuditHours(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-sm text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={manualAuditHours}
                onChange={(e) => setManualAuditHours(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>0</span>
                <span>40 hours</span>
              </div>
            </div>
          </div>

          {/* Outputs Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Main ROI Multiplier Callout */}
            <div className="bg-gradient-to-br from-emerald-950/20 to-teal-950/20 border border-emerald-500/30 rounded-2xl p-6 text-center">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest block mb-1">
                Estimated ROI Multiplier
              </span>
              <p className="text-5xl font-extrabold text-emerald-400 tracking-tight my-2">
                {results.roiMultiplier.toFixed(1)}x ROI
              </p>
              <p className="text-sm text-emerald-300">
                Total annual savings of <strong className="text-white">{fmt(results.totalAnnualROI)}</strong>
              </p>
            </div>

            {/* Calculations List */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Live Cost Savings Breakdown</h3>
              
              <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                <div>
                  <span className="text-sm font-semibold text-white block">Cost Optimization Savings</span>
                  <span className="text-xs text-slate-500">30% reduction on LLM API spend</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-200 font-mono">{fmt(results.monthlyCostSavings)}/mo</span>
                  <span className="text-xs text-slate-500 block">({fmt(results.annualCostSavings)}/yr)</span>
                </div>
              </div>

              <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                <div>
                  <span className="text-sm font-semibold text-white block">Breach Risk Reduction</span>
                  <span className="text-xs text-slate-500">15% probability reduction × 12 mo</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-200 font-mono">{fmt(results.annualBreachRiskReduction)}/yr</span>
                </div>
              </div>

              <div className="flex justify-between items-start pb-1">
                <div>
                  <span className="text-sm font-semibold text-white block">Engineering Hours Saved</span>
                  <span className="text-xs text-slate-500">52 weeks × manual audit hours</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-200 font-mono">{results.hoursSavedPerYear} hrs/yr</span>
                  <span className="text-xs text-slate-500 block">({fmt(results.valueOfHoursSaved)} value @ $80/hr)</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-slate-400 text-sm">
                <span>RakshEx Pro Plan Cost</span>
                <span className="font-mono text-slate-300 font-semibold">$99/mo = $1,188/yr</span>
              </div>
            </div>

            {/* Trial CTA */}
            <div className="text-center pt-2">
              <Link
                href="/demo"
                className="w-full block text-center px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Start Free Trial
              </Link>
              <p className="text-[11px] text-slate-500 mt-2">
                14-day full featured trial. Setup in 5 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
