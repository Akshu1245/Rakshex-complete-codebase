"use client";
import { useState } from "react";

export default function ROICalculator() {
  const [devs, setDevs] = useState(10);
  const [apis, setApis] = useState(15);
  const [llmSpend, setLlmSpend] = useState(2000);
  const [incidents, setIncidents] = useState(2);

  const annualSavings = Math.round(
    devs * 520 + // dev hours saved (1hr/week * $10/hr * 52)
      apis * 12 + // security scanning value per endpoint
      llmSpend * 0.3 * 12 + // 30% LLM cost savings
      incidents * 50000, // cost per incident avoided
  );

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
      <h3 className="text-2xl font-bold mb-6 text-center">ROI Calculator</h3>
      <p className="text-gray-400 text-center mb-8 text-sm">
        Estimate your annual savings with RaksHex
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <SliderField
          label="Developers"
          value={devs}
          min={1}
          max={100}
          step={1}
          onChange={setDevs}
        />
        <SliderField
          label="API Endpoints"
          value={apis}
          min={1}
          max={200}
          step={1}
          onChange={setApis}
        />
        <SliderField
          label="Monthly LLM Spend ($)"
          value={llmSpend}
          min={100}
          max={50000}
          step={100}
          onChange={setLlmSpend}
        />
        <SliderField
          label="Incidents/Year"
          value={incidents}
          min={0}
          max={20}
          step={1}
          onChange={setIncidents}
        />
      </div>

      <div className="bg-gray-700/50 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm mb-2">Estimated Annual Savings</p>
        <p className="text-5xl font-bold text-green-400 mb-2">${annualSavings.toLocaleString()}</p>
        <p className="text-gray-500 text-xs">
          Based on {devs} developers, {apis} endpoints, ${llmSpend.toLocaleString()}/mo LLM spend,{" "}
          {incidents} incidents/year
        </p>
      </div>

      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          RaksHex Pro: $99/mo → Your ROI:{" "}
          <span className="text-green-400 font-bold">{Math.round(annualSavings / (99 * 12))}x</span>
        </p>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-300 text-sm">{label}</span>
        <span className="text-blue-400 font-bold text-sm">{value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}
