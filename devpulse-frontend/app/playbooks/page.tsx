"use client";
import { useState } from "react";
import {
  BookOpen,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Shield,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Playbook {
  id: string;
  title: string;
  description: string;
  category: "security" | "cost" | "compliance" | "incident";
  steps: string[];
  estimatedTime: string;
  severity: "low" | "medium" | "high" | "critical";
  automated: boolean;
}

const PLAYBOOKS: Playbook[] = [
  {
    id: "pb1",
    title: "Critical Secret Exposed in API Collection",
    description:
      "Immediate response playbook when a live API key or credential is found in an imported collection.",
    category: "security",
    steps: [
      "Immediately revoke the exposed credential in the provider dashboard (AWS IAM, GitHub, OpenAI, etc.)",
      "Generate a new credential and rotate it in all dependent services",
      "Check audit log for any unauthorized usage of the exposed key",
      "Remove the secret from the collection and re-scan to confirm remediation",
      "Add the credential pattern to your .gitignore and secret scanning pre-commit hooks",
      "File an incident report and notify affected stakeholders within 24h",
    ],
    estimatedTime: "30–60 min",
    severity: "critical",
    automated: false,
  },
  {
    id: "pb2",
    title: "LLM Cost Spike — Budget Exceeded",
    description: "Runbook for when AI spend exceeds your configured budget threshold or daily cap.",
    category: "cost",
    steps: [
      "Kill switch is auto-triggered if enabled — verify it fired correctly in Kill Switch dashboard",
      "Identify which agent/model caused the spike using Token Analytics",
      "Check for infinite loops: look for repeated identical prompts in audit log",
      "Review context window size — bloated context is the #1 cost driver",
      "Implement per-agent budget caps with alerting (Settings → Kill Switch → Budget Caps)",
      "Optimize prompt templates and enable caching for repeated queries",
      "Reset kill switch and resume with tighter limits",
    ],
    estimatedTime: "15–30 min",
    severity: "high",
    automated: true,
  },
  {
    id: "pb3",
    title: "Prompt Injection Attack Detected",
    description:
      "Response playbook for when a prompt injection or jailbreak attempt is blocked at the gateway.",
    category: "security",
    steps: [
      "Review the blocked payload in the audit log — understand the attack vector",
      "Identify the agent and endpoint that received the injection",
      "Check if any downstream actions were taken before the block fired",
      "Add the attack pattern to your custom blocklist if not already covered",
      "Review system prompt hardening — add explicit role anchoring",
      "Enable PII redaction if user inputs are flowing into prompts",
      "Report novel attack patterns to Rakshex (helps improve the detection library)",
    ],
    estimatedTime: "20–45 min",
    severity: "high",
    automated: true,
  },
  {
    id: "pb4",
    title: "PCI DSS Compliance Failure",
    description: "Steps to resolve PCI DSS compliance failures before an audit.",
    category: "compliance",
    steps: [
      "Download the failing controls report from Compliance → PCI DSS",
      "Prioritize Critical failures — these block compliance certification",
      "For 'Insecure Transmission': enforce TLS 1.2+ on all API endpoints",
      "For 'Missing Auth': add API key validation to all sensitive endpoints",
      "For 'Logging Gap': ensure audit log captures all card-data-adjacent API calls",
      "Re-run the compliance scan after fixes to verify remediation",
      "Generate the updated evidence package for your auditor",
    ],
    estimatedTime: "2–8 hours",
    severity: "critical",
    automated: false,
  },
  {
    id: "pb5",
    title: "Shadow API Discovered in Production",
    description:
      "Handle undocumented endpoints found by the shadow API scanner that are live in production.",
    category: "security",
    steps: [
      "Identify the framework and codebase the endpoint belongs to",
      "Check if the endpoint is intentionally undocumented or accidentally exposed",
      "If unintentional: disable or firewall the endpoint immediately",
      "If intentional: add it to your API collection and run a full security scan",
      "Review access controls — shadow APIs often lack auth",
      "Document the endpoint in your OpenAPI spec",
      "Set up automated shadow API detection in your CI/CD pipeline",
    ],
    estimatedTime: "1–3 hours",
    severity: "medium",
    automated: true,
  },
  {
    id: "pb6",
    title: "Agent Drift — Behavior Degradation",
    description:
      "Response when an agent's output quality, cost, or latency drifts significantly from its baseline.",
    category: "incident",
    steps: [
      "Open Agent Drift Monitor and find the affected agent",
      "Note the drift score, type (cost/latency/behavior), and start time",
      "Check if a model version change occurred around the drift start time",
      "Compare current system prompt to the baseline snapshot",
      "Review if input data distribution has shifted (new users, new query types)",
      "Roll back to previous model or prompt configuration if available",
      "Set a new baseline once the agent is stable",
    ],
    estimatedTime: "30–90 min",
    severity: "medium",
    automated: false,
  },
];

const CATEGORY_COLORS = {
  security: "text-red-400 bg-red-500/10 border-red-500/20",
  cost: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  compliance: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  incident: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const SEVERITY_COLORS = {
  low: "text-blue-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export default function PlaybooksPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? PLAYBOOKS
      : PLAYBOOKS.filter((p) => p.category === filter || p.severity === filter);

  return (
    <div className="text-white p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            Security Playbooks
          </h1>
          <p className="text-gray-400 mt-1">
            Step-by-step runbooks for common security and cost incidents
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{PLAYBOOKS.length}</p>
          <p className="text-gray-400 text-sm">playbooks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "security", "cost", "compliance", "incident", "critical", "high"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Playbook cards */}
      <div className="space-y-4">
        {filtered.map((pb) => (
          <div
            key={pb.id}
            className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
          >
            <button
              className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-750 transition-colors"
              onClick={() => setExpanded(expanded === pb.id ? null : pb.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize ${CATEGORY_COLORS[pb.category]}`}
                  >
                    {pb.category}
                  </span>
                  <span
                    className={`text-xs font-semibold capitalize ${SEVERITY_COLORS[pb.severity]}`}
                  >
                    {pb.severity} severity
                  </span>
                  {pb.automated && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Auto-detection
                    </span>
                  )}
                  <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" /> {pb.estimatedTime}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{pb.title}</h3>
                <p className="text-gray-400 text-sm mt-1">{pb.description}</p>
              </div>
              <div className="shrink-0 text-gray-500 mt-1">
                {expanded === pb.id ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </button>

            {expanded === pb.id && (
              <div className="border-t border-gray-700 p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-4">
                  Response Steps
                </p>
                <ol className="space-y-3">
                  {pb.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                    <Play className="w-4 h-4" /> Start Runbook
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Mark Complete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
