"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export default function ROICalculator() {
  const [monthlySpend, setMonthlySpend] = useState(5000);
  const [incidentsPerYear, setIncidentsPerYear] = useState(2);
  const [avgIncidentCost, setAvgIncidentCost] = useState(25000);
  const [teamSize, setTeamSize] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(75);
  const [complianceRequired, setComplianceRequired] = useState(true);

  const results = useMemo(() => {
    // Cost of doing nothing
    const annualIncidentCost = incidentsPerYear * avgIncidentCost;
    const auditPrepHours = complianceRequired ? teamSize * 40 : 0; // 1 week per person
    const auditPrepCost = auditPrepHours * hourlyRate;
    const manualMonitoringHours = teamSize * 4 * 12; // 4 hrs/month/person
    const manualMonitoringCost = manualMonitoringHours * hourlyRate;
    const totalCostOfNothing = annualIncidentCost + auditPrepCost + manualMonitoringCost;

    // Cost of Rakshex
    const rakshexProCost = 99 * 12; // $99/mo
    const rakshexSetupHours = 8;
    const rakshexSetupCost = rakshexSetupHours * hourlyRate;
    const reducedIncidents = Math.max(0, incidentsPerYear - 1); // Rakshex prevents ~1 incident/yr
    const reducedIncidentCost = reducedIncidents * avgIncidentCost;
    const totalRakshexCost = rakshexProCost + rakshexSetupCost + reducedIncidentCost;

    const savings = totalCostOfNothing - totalRakshexCost;
    const roi = ((savings - rakshexProCost) / rakshexProCost) * 100;
    const paybackMonths =
      rakshexProCost > 0 ? (rakshexSetupCost + rakshexProCost) / (savings / 12) : 0;

    return {
      totalCostOfNothing,
      totalRakshexCost,
      savings,
      roi: Math.round(roi),
      paybackMonths: Math.max(0.1, paybackMonths),
      annualIncidentCost,
      auditPrepCost,
      manualMonitoringCost,
      rakshexProCost,
      rakshexSetupCost,
    };
  }, [monthlySpend, incidentsPerYear, avgIncidentCost, teamSize, hourlyRate, complianceRequired]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-gray-400 mb-4">
          <Link href="/pricing" className="hover:text-blue-400">
            ← Pricing
          </Link>
        </nav>

        <h1 className="text-4xl font-bold mb-2">AI Security ROI Calculator</h1>
        <p className="text-gray-400 mb-8">
          Calculate what unmonitored AI agents cost your organization — and what Rakshex saves.
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-blue-400">Your Environment</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Monthly LLM Spend (USD)</label>
              <input
                type="range"
                min="500"
                max="100000"
                step="500"
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-blue-300 font-mono">{fmt(monthlySpend)}</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Security Incidents per Year
              </label>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={incidentsPerYear}
                onChange={(e) => setIncidentsPerYear(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-blue-300 font-mono">{incidentsPerYear}</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Avg Cost per Incident (USD)
              </label>
              <input
                type="range"
                min="5000"
                max="200000"
                step="5000"
                value={avgIncidentCost}
                onChange={(e) => setAvgIncidentCost(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-blue-300 font-mono">{fmt(avgIncidentCost)}</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Engineering Team Size</label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-blue-300 font-mono">{teamSize}</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Avg Hourly Rate (USD)</label>
              <input
                type="range"
                min="25"
                max="300"
                step="5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-blue-300 font-mono">{fmt(hourlyRate)}</div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={complianceRequired}
                onChange={(e) => setComplianceRequired(e.target.checked)}
                className="w-5 h-5 accent-blue-500"
              />
              <label className="text-gray-300">Compliance required (PCI DSS / SOC 2 / GDPR)</label>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">Cost of Doing Nothing</h2>
              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between">
                  <span>Annual incident cost</span>
                  <span className="font-mono">{fmt(results.annualIncidentCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Manual monitoring (engineer time)</span>
                  <span className="font-mono">{fmt(results.manualMonitoringCost)}</span>
                </div>
                {complianceRequired && (
                  <div className="flex justify-between">
                    <span>Audit preparation (engineer time)</span>
                    <span className="font-mono">{fmt(results.auditPrepCost)}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 flex justify-between font-bold text-red-300">
                  <span>Total annual cost</span>
                  <span className="font-mono">{fmt(results.totalCostOfNothing)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-blue-500/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-4">Cost with Rakshex</h2>
              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between">
                  <span>Rakshex Pro (annual)</span>
                  <span className="font-mono">{fmt(results.rakshexProCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Setup (one-time)</span>
                  <span className="font-mono">{fmt(results.rakshexSetupCost)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Residual incident cost (1/yr)</span>
                  <span className="font-mono">
                    {fmt(
                      results.totalRakshexCost - results.rakshexProCost - results.rakshexSetupCost,
                    )}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between font-bold text-blue-300">
                  <span>Total annual cost</span>
                  <span className="font-mono">{fmt(results.totalRakshexCost)}</span>
                </div>
              </div>
            </div>

            <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-6 text-center">
              <p className="text-green-300 text-sm uppercase tracking-wide mb-1">Annual Savings</p>
              <p className="text-4xl font-bold text-green-400 mb-2">{fmt(results.savings)}</p>
              <p className="text-green-300 text-sm">
                {results.roi}x ROI · Payback in {results.paybackMonths.toFixed(1)} months
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/demo"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Start Free Trial →
          </Link>
        </div>
      </div>
    </div>
  );
}
