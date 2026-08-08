"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Shield,
  Zap,
  Sparkles,
  BarChart2,
} from "lucide-react";
import Link from "next/link";

interface CompetitorProfile {
  id: string;
  name: string;
  category: string;
  summary: string;
  link: string;
  features: {
    name: string;
    raksHex: { supported: boolean; detail: string };
    competitor: { supported: boolean | "partial"; detail: string };
  }[];
}

const COMPETITORS: CompetitorProfile[] = [
  {
    id: "snyk",
    name: "Snyk",
    category: "Static Code & Dependency Scanner",
    summary:
      "Snyk scans repos and dependencies for known CVEs before code ships. It doesn't evaluate what an already-running AI agent is authorized to do at call time.",
    link: "/compare/rakshex-vs-snyk",
    features: [
      {
        name: "Primary Security Focus",
        raksHex: { supported: true, detail: "Runtime action authorization for AI agents" },
        competitor: { supported: false, detail: "Static code vulnerabilities (SAST/SCA)" },
      },
      {
        name: "Semantic Action Authorization",
        raksHex: { supported: true, detail: "Evaluates each action against delegated authority" },
        competitor: { supported: false, detail: "No runtime action model" },
      },
      {
        name: "Credential Mediation",
        raksHex: { supported: true, detail: "Broker enforces DENY at the credential" },
        competitor: { supported: false, detail: "No credential brokering" },
      },
      {
        name: "Tamper-Evident Action Ledger",
        raksHex: { supported: true, detail: "Hash-chained record of every decision" },
        competitor: { supported: false, detail: "No runtime decision ledger" },
      },
      {
        name: "MCP Tool Governance",
        raksHex: { supported: true, detail: "Adversarial-intent scanning on tool calls" },
        competitor: { supported: "partial", detail: "Scans hardcoded secrets in source" },
      },
    ],
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "General APM & Infrastructure Observability",
    summary:
      "Datadog is built to observe and alert on what already happened. It has no concept of authorizing an individual agent action before it executes.",
    link: "/compare/rakshex-vs-datadog",
    features: [
      {
        name: "Enforcement vs Observability",
        raksHex: { supported: true, detail: "Blocks the action before it executes" },
        competitor: { supported: false, detail: "Alerts after the fact" },
      },
      {
        name: "Delegated Authority Model",
        raksHex: { supported: true, detail: "Parent-to-child attenuation, enforced in code" },
        competitor: { supported: false, detail: "No authority/attenuation concept" },
      },
      {
        name: "Policy Engine",
        raksHex: { supported: true, detail: "Priority-ordered rules evaluated per action" },
        competitor: { supported: "partial", detail: "Custom alerting rules, not authorization" },
      },
      {
        name: "MCP-Aware Monitoring",
        raksHex: { supported: true, detail: "Adversarial-intent scanning on MCP tool calls" },
        competitor: { supported: false, detail: "No MCP-specific tooling" },
      },
      {
        name: "Auditable Decision Trail",
        raksHex: { supported: true, detail: "Hash-chained Action Ledger" },
        competitor: { supported: "partial", detail: "General-purpose log retention" },
      },
    ],
  },
  {
    id: "lakera",
    name: "Lakera",
    category: "Point Solution Prompt Guard",
    summary:
      "Lakera focuses on detecting prompt injection at the input layer. RaksHex operates a layer deeper: authorizing the action the model wants to take, independent of how the prompt was worded.",
    link: "/compare/rakshex-vs-lakera",
    features: [
      {
        name: "Scope",
        raksHex: { supported: true, detail: "Action authorization + delegated authority" },
        competitor: { supported: true, detail: "Prompt injection detection API" },
      },
      {
        name: "Credential Enforcement",
        raksHex: { supported: true, detail: "DENY blocks the credential itself" },
        competitor: { supported: false, detail: "Detection only, no credential control" },
      },
      {
        name: "Delegated Authority & Attenuation",
        raksHex: { supported: true, detail: "Child scope can't exceed parent scope" },
        competitor: { supported: false, detail: "No authority model" },
      },
      {
        name: "MCP Tool Allowlisting",
        raksHex: { supported: true, detail: "Adversarial-intent scanning on tool calls" },
        competitor: { supported: false, detail: "No MCP tool governance" },
      },
      {
        name: "Tamper-Evident Audit Trail",
        raksHex: { supported: true, detail: "Hash-chained Action Ledger" },
        competitor: { supported: false, detail: "No authorization ledger" },
      },
    ],
  },
  {
    id: "portkey",
    name: "Portkey / Helicone",
    category: "LLM Gateway & Request Router",
    summary:
      "Portkey and Helicone route and log LLM traffic. Routing tells you a request went through; it doesn't tell you whether that specific action should have been allowed.",
    link: "/compare/rakshex-vs-portkey",
    features: [
      {
        name: "Action-Level Authorization",
        raksHex: { supported: true, detail: "Every semantic action evaluated at call time" },
        competitor: { supported: "partial", detail: "Rate limiting & fallback routing" },
      },
      {
        name: "Enforced Denial",
        raksHex: { supported: true, detail: "DENY blocks the credential, not just the route" },
        competitor: { supported: false, detail: "Manual key revocation to actually stop a caller" },
      },
      {
        name: "Delegated Authority",
        raksHex: { supported: true, detail: "Parent-to-child attenuation" },
        competitor: { supported: false, detail: "No sub-scoped authority model" },
      },
      {
        name: "Credential Mediation",
        raksHex: { supported: true, detail: "Claim-before-spend, no-redirect broker" },
        competitor: { supported: "partial", detail: "Gateway-level key management" },
      },
      {
        name: "Tamper-Evident Ledger",
        raksHex: { supported: true, detail: "Hash-chained Action Ledger" },
        competitor: { supported: false, detail: "Request logs, not a decision ledger" },
      },
    ],
  },
  {
    id: "traceable",
    name: "Traceable AI / Salt Security",
    category: "Legacy API Security Platform",
    summary:
      "Traceable and Salt Security analyze REST/GraphQL API traffic patterns. Neither has a concept of an AI agent's delegated authority or a semantic action model.",
    link: "/compare/rakshex-vs-traceable",
    features: [
      {
        name: "AI Agent-Specific Model",
        raksHex: { supported: true, detail: "Semantic actions, delegated authority, attenuation" },
        competitor: { supported: false, detail: "Generic REST/GraphQL API inspection" },
      },
      {
        name: "Credential Mediation",
        raksHex: { supported: true, detail: "Fail-closed broker enforces DENY" },
        competitor: { supported: false, detail: "No credential brokering" },
      },
      {
        name: "MCP Tool Governance",
        raksHex: { supported: true, detail: "Adversarial-intent scanning on tool calls" },
        competitor: { supported: false, detail: "No MCP-specific coverage" },
      },
      {
        name: "Tamper-Evident Ledger",
        raksHex: { supported: true, detail: "Hash-chained Action Ledger" },
        competitor: { supported: false, detail: "Standard traffic logs" },
      },
      {
        name: "Integration Model",
        raksHex: { supported: true, detail: "SDK-based, into the agent's call path" },
        competitor: { supported: false, detail: "Network-level API gateway deployment" },
      },
    ],
  },
];

export function OneOnOneMatrix() {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("snyk");

  const currentProfile = COMPETITORS.find((c) => c.id === selectedCompetitor) || COMPETITORS[0];

  return (
    <section
      id="one-on-one-matrix"
      className="w-full py-24 px-4 md:px-8 bg-[#0B0F17] relative scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Head-to-Head Comparison Matrix
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-sans">
            How <span className="text-[#14B8A6]">RaksHex</span> Compares 1-on-1
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Select a competitor below to see detailed side-by-side feature capabilities, security
            coverage, and operational differences.
          </p>
        </div>

        {/* Competitor Tabs */}
        <div className="flex justify-center items-center gap-2 flex-wrap">
          {COMPETITORS.map((comp) => {
            const isSelected = comp.id === selectedCompetitor;
            return (
              <button
                key={comp.id}
                onClick={() => setSelectedCompetitor(comp.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#14B8A6] text-white border-[#14B8A6] shadow-[0_0_15px_rgba(20,184,166,0.3)] scale-[1.03]"
                    : "bg-[#0F1419] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                }`}
              >
                RaksHex vs {comp.name}
              </button>
            );
          })}
        </div>

        {/* Selected Competitor Summary Card */}
        <div className="bg-[#090D14] border border-[#14B8A6]/30 rounded-xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-mono text-[#14B8A6] uppercase tracking-wider">
                Category: {currentProfile.category}
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                RaksHex vs {currentProfile.name}
              </h3>
              <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-3xl leading-relaxed">
                {currentProfile.summary}
              </p>
            </div>
            <Link
              href={currentProfile.link}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold hover:bg-[#14B8A6]/20 transition-all shrink-0 w-fit"
            >
              <span>Full {currentProfile.name} Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Comparison Table Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-12 text-xs font-mono text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-800/80 px-2">
              <div className="col-span-5 md:col-span-4">Capability</div>
              <div className="col-span-4 md:col-span-4 text-emerald-400 font-bold">
                RaksHex Control Plane
              </div>
              <div className="col-span-3 md:col-span-4 text-slate-300">{currentProfile.name}</div>
            </div>

            {currentProfile.features.map((feat, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-[#14B8A6]/30 transition-all text-xs md:text-sm"
              >
                {/* Feature Name */}
                <div className="col-span-5 md:col-span-4 font-medium text-white pr-2">
                  {feat.name}
                </div>

                {/* RaksHex Capability */}
                <div className="col-span-4 md:col-span-4 flex items-start gap-2 text-emerald-400 pr-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold block text-white text-xs">
                      {feat.raksHex.detail}
                    </span>
                  </div>
                </div>

                {/* Competitor Capability */}
                <div className="col-span-3 md:col-span-4 flex items-start gap-2 text-slate-400 pr-2">
                  {feat.competitor.supported === true ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : feat.competitor.supported === "partial" ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  )}
                  <div>
                    <span className="text-xs text-slate-300 block">{feat.competitor.detail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
