"use client";

import { useState } from "react";
import { Terminal, Code, Github, Copy, Check } from "lucide-react";

const tabs = [
  { id: "cli", label: "SDK", icon: Terminal },
  { id: "vscode", label: "Policy", icon: Code },
  { id: "github", label: "CI", icon: Github },
];

const cliCode = `import { RaksHexFirewall } from "@rakshex/sdk";

const firewall = new RaksHexFirewall();

const decision = await firewall.authorize({
  action: "financial.refund",
  authority: delegatedAuthority,
  params: { amount: 40, orderId },
});

if (decision.effect === "DENY") {
  throw new Error(decision.reason);
}`;

const vscodeCode = `# Define a policy rule
rule:
  action: financial.refund
  condition: "amount > authority.limit"
  effect: DENY
  priority: 10

# Rules are evaluated in priority order
# and every decision is written to the
# hash-chained Action Ledger.`;

const githubCode = `name: RaksHex Policy Check
on: [push, pull_request]
jobs:
  policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate policy rules
        run: pnpm rakshex policy lint
      - name: Run differential policy test
        run: pnpm rakshex policy test`;

export function InstallSection() {
  const [activeTab, setActiveTab] = useState("cli");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = activeTab === "cli" ? cliCode : activeTab === "vscode" ? vscodeCode : githubCode;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const code = activeTab === "cli" ? cliCode : activeTab === "vscode" ? vscodeCode : githubCode;

  return (
    <section
      className="w-full max-w-[1280px] mx-auto py-24 px-6 xl:px-8 bg-transparent"
      id="install"
    >
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-[36px] font-bold font-sans text-white leading-tight tracking-[-0.02em] mb-4">
          Integrate the Agent Firewall
        </h2>
        <p className="text-[#9CA3AF] text-base max-w-lg mx-auto">
          Authorize actions in your agent's call path, define policy, or gate it in CI.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#14B8A6] text-black"
                  : "bg-transparent text-[#9CA3AF] hover:text-white border border-white/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Code Block */}
      <div className="max-w-2xl mx-auto bg-black/40 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-transparent border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="p-5 overflow-x-auto">
          <code className="text-sm font-mono text-[#14B8A6] whitespace-pre">{code}</code>
        </pre>
      </div>

      {/* Policy docs CTA */}
      {activeTab === "vscode" && (
        <div className="text-center mt-6">
          <a
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#14B8A6] text-black font-semibold rounded-lg hover:bg-[#0D9488] transition-colors"
          >
            <Code className="w-5 h-5" />
            Read the policy engine docs
          </a>
        </div>
      )}
    </section>
  );
}
