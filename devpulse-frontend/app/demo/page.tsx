"use client";

import React, { useState, useEffect } from "react";

const ENDPOINTS = [
  { method: "GET", path: "/v1/customers" },
  { method: "GET", path: "/v1/customers/{id}" },
  { method: "POST", path: "/v1/customers" },
  { method: "DELETE", path: "/v1/customers/{id}" },
  { method: "GET", path: "/v1/charges" },
  { method: "POST", path: "/v1/charges" },
  { method: "GET", path: "/v1/charges/{id}" },
  { method: "POST", path: "/v1/refunds" },
  { method: "GET", path: "/v1/invoices" },
  { method: "POST", path: "/v1/invoices" },
  { method: "GET", path: "/v1/payment_intents" },
  { method: "POST", path: "/v1/payment_intents" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-primary/20 text-primary border border-primary/30",
  POST: "bg-tertiary/20 text-tertiary border border-tertiary/30",
  DELETE: "bg-error/20 text-error border border-error/30",
  PUT: "bg-secondary/20 text-secondary border border-secondary/30",
};

const MOCK_FINDINGS = [
  {
    id: "f1",
    severity: "Critical" as const,
    owasp: "API1:2023",
    title: "Broken Object Level Authorization",
    endpoint: "GET /v1/customers/{id}",
    detail:
      "Customer ID is user-supplied. No ownership check on the authenticated user's session. Any authenticated user can read any customer record.",
    fix: "Validate that the authenticated user owns the requested customer ID before returning data.",
  },
  {
    id: "f2",
    severity: "High" as const,
    owasp: "API3:2023",
    title: "Excessive Data Exposure — PAN in response body",
    endpoint: "GET /v1/charges/{id}",
    detail:
      "Response includes raw card.number and card.cvc fields. PCI DSS requires these to be masked or omitted entirely in API responses.",
    fix: "Strip card.cvc from all responses. Mask card.number to last 4 digits only.",
  },
  {
    id: "f3",
    severity: "High" as const,
    owasp: "API2:2023",
    title: "Missing Rate Limiting on Payment Intent creation",
    endpoint: "POST /v1/payment_intents",
    detail:
      "No X-RateLimit headers observed. Attackers can enumerate payment intents or perform card-testing attacks at scale.",
    fix: "Implement per-IP and per-user rate limiting. Return 429 with Retry-After header.",
  },
];

const SEVERITY_COLOR = {
  Critical: "text-error bg-error/10 border border-error/30",
  High: "text-orange-400 bg-orange-400/10 border border-orange-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30",
  Low: "text-primary bg-primary/10 border border-primary/30",
};

const TOKEN_AGENTS = [
  { agent: "stripe-billing-agent", model: "gpt-4o", tokens: 1420, cost: 0.0142 },
  { agent: "fraud-detection-llm", model: "claude-3-5-sonnet", tokens: 2830, cost: 0.0339 },
  { agent: "support-copilot", model: "gpt-4o-mini", tokens: 890, cost: 0.0027 },
  { agent: "invoice-summariser", model: "claude-3-haiku", tokens: 3100, cost: 0.0062 },
  { agent: "chargeback-analyst", model: "gpt-4o", tokens: 1960, cost: 0.0196 },
];

export default function DemoPage() {
  const [liveCost, setLiveCost] = useState(0.0766);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveCost((c) => parseFloat((c + Math.random() * 0.003 + 0.0005).toFixed(4)));
      setTick((t) => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-on-background pb-16"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* HEADER */}
      <div className="border-b border-outline-variant/20 bg-surface-container-low/60 backdrop-blur-xl px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-xs tracking-widest font-bold">
                INTERACTIVE DEMO — NO LOGIN REQUIRED
              </span>
            </div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "28px",
                fontWeight: 700,
              }}
            >
              Stripe API Security Scan · Mock Results
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              All data is hardcoded. No network calls are made. Scan ran in 347ms.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/register"
              className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs tracking-widest hover:shadow-[0_0_16px_rgba(207,188,255,0.4)] transition-all"
            >
              START FREE TRIAL →
            </a>
            <a
              href="/import"
              className="px-5 py-2.5 border border-outline-variant text-on-surface-variant text-xs tracking-widest hover:bg-surface-variant/30 transition-all"
            >
              IMPORT YOUR API
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 pt-8 space-y-8">
        {/* SECTION 1 — Mock Collection Card */}
        <div className="glass-card rounded-xl p-6">
          <p className="text-on-surface-variant text-xs tracking-widest mb-4">COLLECTION SCANNED</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-container/30 rounded-lg flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontSize: "24px", fontVariationSettings: "'FILL' 1" }}
                >
                  api
                </span>
              </div>
              <div>
                <p
                  className="text-on-surface font-bold"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px" }}
                >
                  Stripe Payment API
                </p>
                <p className="text-on-surface-variant text-xs mt-0.5">
                  stripe-v1-production.postman_collection.json · 12 endpoints
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              {[
                { label: "ENDPOINTS", value: "12" },
                { label: "METHODS", value: "GET · POST · DELETE" },
                { label: "SCAN TIME", value: "347ms" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-on-surface-variant text-xs">{s.label}</p>
                  <p className="text-on-surface font-bold text-sm mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ENDPOINTS.map((e, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded font-mono ${METHOD_COLORS[e.method] ?? ""}`}
              >
                {e.method} {e.path}
              </span>
            ))}
          </div>
        </div>

        {/* SECTION 2 — Findings Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "CRITICAL", value: "1", color: "text-error" },
            { label: "HIGH", value: "2", color: "text-orange-400" },
            { label: "MEDIUM", value: "3", color: "text-yellow-400" },
            { label: "OWASP SCORE", value: "44/100", color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-5">
              <p className="text-on-surface-variant text-xs tracking-widest mb-2">{s.label}</p>
              <p
                className={`font-bold ${s.color}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "32px" }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* SECTION 3 — Top 3 Findings */}
        <div>
          <p className="text-on-surface-variant text-xs tracking-widest mb-4">TOP FINDINGS</p>
          <div className="space-y-4">
            {MOCK_FINDINGS.map((f) => (
              <div key={f.id} className="glass-card rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded font-bold ${SEVERITY_COLOR[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-on-surface-variant text-xs">{f.owasp}</span>
                  </div>
                  <span className="text-on-surface-variant text-xs font-mono">{f.endpoint}</span>
                </div>
                <p
                  className="text-on-surface font-bold mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {f.title}
                </p>
                <p className="text-on-surface-variant text-sm mb-3 leading-relaxed">{f.detail}</p>
                <div className="bg-primary/5 border-l-2 border-primary px-4 py-2">
                  <span className="text-primary text-xs font-bold">FIX: </span>
                  <span className="text-on-surface-variant text-xs">{f.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4 — Live Token Cost Feed */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-on-surface-variant text-xs tracking-widest">LIVE TOKEN COST FEED</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-xs">STREAMING</span>
            </div>
          </div>
          <div className="mb-6">
            <p className="text-on-surface-variant text-xs mb-1">SESSION TOTAL</p>
            <p
              className="text-primary"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "40px",
                fontWeight: 700,
              }}
            >
              ${liveCost.toFixed(4)}
            </p>
            <p className="text-on-surface-variant text-xs mt-1">
              Tick #{tick} · updates every 1.4s
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ fontSize: "12px" }}>
              <thead className="border-b border-outline-variant/10">
                <tr className="text-on-surface-variant text-xs tracking-widest">
                  <th className="pb-2 pr-4">AGENT</th>
                  <th className="pb-2 pr-4">MODEL</th>
                  <th className="pb-2 pr-4 text-right">TOKENS</th>
                  <th className="pb-2 text-right">COST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {TOKEN_AGENTS.map((a, i) => (
                  <tr key={i} className={i === tick % TOKEN_AGENTS.length ? "bg-primary/5" : ""}>
                    <td className="py-2 pr-4 text-on-surface font-bold">{a.agent}</td>
                    <td className="py-2 pr-4 text-on-surface-variant">{a.model}</td>
                    <td className="py-2 pr-4 text-right text-on-surface">
                      {a.tokens.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-primary">${a.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5 — CTA */}
        <div className="glass-card rounded-xl p-8 text-center border border-primary/20">
          <p className="text-primary text-xs tracking-widest mb-3">
            READY TO SECURE YOUR REAL APIs?
          </p>
          <h2
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "24px", fontWeight: 700 }}
            className="mb-3"
          >
            Import your Postman collection and get real results in 60 seconds
          </h2>
          <p className="text-on-surface-variant text-sm mb-6 max-w-lg mx-auto leading-relaxed">
            Supports Postman v2.1, OpenAPI 3.x, and Bruno. Free tier includes 50 scans/month and 5
            LLM agents. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="px-8 py-3 bg-primary text-on-primary font-bold text-xs tracking-widest hover:shadow-[0_0_20px_rgba(207,188,255,0.4)] transition-all"
            >
              START FREE — SCAN MY APIS →
            </a>
            <a
              href="/import"
              className="px-8 py-3 border border-outline-variant text-on-surface-variant text-xs tracking-widest hover:bg-surface-variant/30 transition-all"
            >
              IMPORT COLLECTION
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
