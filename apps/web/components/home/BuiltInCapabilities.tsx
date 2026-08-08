"use client";

import React, { useState } from "react";
import { Shield, BarChart2, Terminal, Code } from "lucide-react";

interface CapabilityTab {
  id: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
}

const CAPABILITIES: CapabilityTab[] = [
  {
    id: "easy-start",
    label: "Semantic actions",
    title: "Semantic actions",
    description:
      "Policy is written against what an agent is doing, not the HTTP call underneath it.",
    bullets: [
      "Actions like financial.refund, not raw endpoints",
      "One policy model across providers",
      "SDK-based integration into your agent's call path",
      "No proxy re-architecture required to get started",
    ],
  },
  {
    id: "reliability",
    label: "Delegated authority",
    title: "Delegated authority",
    description:
      "Authority narrows every time it's delegated — a child scope is never broader than its parent.",
    bullets: [
      "Parent-to-child attenuation, enforced in code",
      "Resource and environment constraints are restrictive by default",
      "Omitted constraints deny rather than silently allow",
      "Every attenuation validated before it's granted",
    ],
  },
  {
    id: "security",
    label: "Credential mediation",
    title: "Credential mediation",
    description:
      "The credential broker sits between the decision and the secret, so enforcement can't be bypassed downstream.",
    bullets: [
      "A DENY blocks the credential, not just the log line",
      "Claim-before-spend: no race on concurrent requests",
      "No redirects — a 302 can't leak a credential off-host",
      "Secrets never appear in list/read responses",
    ],
  },
  {
    id: "console",
    label: "Action Ledger",
    title: "Hash-chained Action Ledger",
    description:
      "Every authorization decision is written to a tamper-evident ledger you can hand to an auditor.",
    bullets: [
      "Hash-chained entries detect tampering",
      "Anti-replay enforced by a database unique index",
      "Full record of who acted under what delegated authority",
      "Built for dispute resolution, not just dashboards",
    ],
  },
  {
    id: "automations",
    label: "Policy engine",
    title: "Policy engine",
    description:
      "Author rules once and evaluate them consistently wherever an action needs a decision.",
    bullets: [
      "Priority-ordered rules with first-match semantics",
      "MCP adversarial-intent scanning on tool calls",
      "Shadow-mode for testing policy before enforcing it",
      "Workspace-scoped rules with RBAC",
    ],
  },
];

/* Custom React UI Preview Widget 1: Semantic actions */
function EasyStartWidget() {
  const [selectedAction, setSelectedAction] = useState("refund");
  const actions: Record<string, string> = {
    refund: "financial.refund",
    delete: "data.deleteRecord",
    deploy: "infra.deploy",
  };
  return (
    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
          <Terminal className="w-4 h-4 text-[#14B8A6]" />
          <span>Semantic Action Authorization</span>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
          Evaluated
        </span>
      </div>

      <div className="flex items-center gap-2">
        {Object.keys(actions).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedAction(key)}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-all ${
              selectedAction === key
                ? "bg-[#14B8A6] text-black shadow-md"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 text-slate-300 space-y-1.5 leading-relaxed overflow-x-auto">
        <div className="text-slate-500">// Authorize a semantic action</div>
        <div>
          <span className="text-purple-400">const</span> decision ={" "}
          <span className="text-purple-400">await</span> firewall.
          <span className="text-blue-400">authorize</span>(&#123;
        </div>
        <div className="pl-4">
          action: <span className="text-emerald-300">&quot;{actions[selectedAction]}&quot;</span>,
        </div>
        <div className="pl-4">authority: delegatedAuthority,</div>
        <div>&#125;);</div>
      </div>
    </div>
  );
}

/* Custom React UI Preview Widget 2: Delegated authority */
function ReliabilityWidget() {
  return (
    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-emerald-400 font-sans font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          Attenuation Chain
        </div>
        <span className="text-emerald-400 font-bold">Valid</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-slate-300">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Parent scope</span>
          <span className="text-lg font-bold text-[#14B8A6] font-sans">refunds ≤ $50</span>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Child scope</span>
          <span className="text-lg font-bold text-teal-400 font-sans">refunds ≤ $20</span>
        </div>
      </div>
    </div>
  );
}

/* Custom React UI Preview Widget 3: Credential mediation */
function SecurityWidget() {
  const [brokerActive, setBrokerActive] = useState(true);
  return (
    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-white font-sans font-bold">
          <Shield className="w-4 h-4 text-[#14B8A6]" />
          <span>Credential Broker</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-500/30 font-sans">
          Fail-closed
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-white font-semibold block font-sans">True decision required</span>
            <span className="text-[10px] text-slate-400">
              Shadow-mode ALLOW never brokers a real DENY
            </span>
          </div>
          <button
            onClick={() => setBrokerActive(!brokerActive)}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
              brokerActive ? "bg-[#14B8A6]" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                brokerActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-white font-semibold block font-sans">No redirects followed</span>
            <span className="text-[10px] text-slate-400">
              A 302 can't leak a credential off-host
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

/* Custom React UI Preview Widget 4: Action Ledger */
function ConsoleWidget() {
  const entries = [
    { id: "0x4a1f", action: "financial.refund", result: "DENY" },
    { id: "0x9c22", action: "data.export", result: "ALLOW" },
    { id: "0x1eb0", action: "infra.deploy", result: "ALLOW" },
  ];
  return (
    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-white font-sans font-bold">
          <BarChart2 className="w-4 h-4 text-[#14B8A6]" />
          <span>Action Ledger</span>
        </div>
        <span className="text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
          Hash-chained
        </span>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between text-[11px] py-1 border-b border-slate-900 last:border-0"
          >
            <span className="text-slate-500">{e.id}</span>
            <span className="text-slate-300 flex-1 px-2 truncate">{e.action}</span>
            <span className={e.result === "DENY" ? "text-red-400" : "text-emerald-400"}>
              {e.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Custom React UI Preview Widget 5: Policy engine */
function AutomationsWidget() {
  return (
    <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-3 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-white font-sans font-bold">
          <Code className="w-4 h-4 text-purple-400" />
          <span>Policy Rule</span>
        </div>
        <span className="text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/30">
          Priority 10
        </span>
      </div>

      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-300 space-y-1.5 leading-relaxed overflow-x-auto">
        <div className="text-slate-500">// Policy rule, priority-sorted evaluation</div>
        <div>
          <span className="text-purple-400">const</span> rule = &#123;
        </div>
        <div className="pl-4">
          action: <span className="text-emerald-300">&quot;financial.refund&quot;</span>,
        </div>
        <div className="pl-4">
          condition:{" "}
          <span className="text-emerald-300">&quot;amount &gt; authority.limit&quot;</span>,
        </div>
        <div className="pl-4">
          effect: <span className="text-red-300">&quot;DENY&quot;</span>
        </div>
        <div>&#125;;</div>
      </div>
    </div>
  );
}

export function BuiltInCapabilities() {
  const [activeTabId, setActiveTabId] = useState<string>("easy-start");

  const activeTab = CAPABILITIES.find((c) => c.id === activeTabId) || CAPABILITIES[0];

  return (
    <section className="w-full py-24 px-4 md:px-8 bg-[#090C12] text-white relative">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-sans">
            Built-in capabilities
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
            The Agent Firewall core, piece by piece: how an action gets authorized, delegated,
            enforced, and recorded.
          </p>
        </div>

        {/* Main ClickHouse-Style Outer Card Container */}
        <div className="bg-[#12151E] border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[440px]">
          {/* Left Vertical Tab Navigation List */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800/80 pr-0 lg:pr-6 pb-6 lg:pb-0 flex flex-row lg:flex-col gap-2 overflow-x-auto scrollbar-none shrink-0">
            {CAPABILITIES.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`text-left text-sm md:text-base transition-all duration-200 cursor-pointer whitespace-nowrap px-4 py-2.5 rounded-full font-medium ${
                    isActive
                      ? "bg-[#E2F952] text-black font-bold shadow-lg scale-[1.02]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right Content Area: Feature Details + Custom React Preview Widget */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-6 items-center pl-0 lg:pl-4">
            {/* Feature Text Details */}
            <div className="md:col-span-6 space-y-5 relative">
              <div className="flex gap-4">
                {/* Yellow Accent Bar */}
                <div className="w-1.5 bg-[#E2F952] rounded-full shrink-0 min-h-[100px]" />
                <div className="space-y-3">
                  <h3 className="text-2xl md:text-3xl font-bold text-white font-sans">
                    {activeTab.title}
                  </h3>
                  <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                    {activeTab.description}
                  </p>
                </div>
              </div>

              {/* Bullet Points */}
              <ul className="space-y-2.5 pt-2 text-xs md:text-sm text-slate-300 font-sans pl-5">
                {activeTab.bullets.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#E2F952] shrink-0 mt-1.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Custom Interactive React RaksHex Preview Widget */}
            <div className="md:col-span-6">
              {activeTabId === "easy-start" && <EasyStartWidget />}
              {activeTabId === "reliability" && <ReliabilityWidget />}
              {activeTabId === "security" && <SecurityWidget />}
              {activeTabId === "console" && <ConsoleWidget />}
              {activeTabId === "automations" && <AutomationsWidget />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
