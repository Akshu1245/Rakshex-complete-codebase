import Link from "next/link";

export const metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about RaksHex, the Agent Firewall for action-level runtime authorization.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "What is RaksHex?",
    a: "RaksHex is an AI agent Action Control Plane — an Agent Firewall. Before your agent executes a consequential action (for example financial.refund), RaksHex evaluates it against your policy and returns a decision: ALLOW, DENY, APPROVAL_REQUIRED, LIMIT, PAUSE, or FREEZE. On ALLOW, a credential broker releases a single-use credential; every decision is recorded in a tamper-evident Action Ledger with signed receipts.",
  },
  {
    q: "How do I start evaluating actions?",
    a: "Create a workspace, write your policy in YAML (or start from the defaults), and call the evaluate API from your agent loop with the proposed action. Node and Python SDKs are available. RaksHex is in private beta — join the waitlist for a scoped evaluation workspace.",
  },
  {
    q: "What data does RaksHex store?",
    a: "Action receipts record decision metadata — the action name, decision, reasons, policy version, and agent — not request or response bodies. Credentials you register for mediation are encrypted at rest and released single-use, only on an ALLOW decision.",
  },
  {
    q: "What compliance standards do you support?",
    a: "RaksHex maps findings and audit events to control language from PCI DSS, SOC 2 Trust Services Criteria, HIPAA, OWASP API Top 10, and OWASP LLM Top 10, and can export that evidence for your auditors. We map product controls to frameworks and produce evidence; we do not claim a certification or independent audit until that assessment is complete and published.",
  },
  {
    q: "How is a DENY enforced?",
    a: "When policy returns DENY, the action must not execute. The enforced execution path only releases the brokered credential on an ALLOW decision — single-use, fresh, and origin-pinned — so a denied action never receives the secret it needs. Enforcement covers actions evaluated through RaksHex; it cannot control traffic that bypasses it.",
  },
  {
    q: "Does RaksHex depend on a specific LLM provider?",
    a: "No. RaksHex authorizes semantic actions (such as financial.refund or data.export), not provider API calls, so your policy works the same regardless of which model or provider your agent uses.",
  },
  {
    q: "How is this different from a code scanner or an APM tool?",
    a: "Scanners find issues in code and APM tools observe metrics after the fact. RaksHex sits in the decision path: it authorizes each consequential action before it executes and keeps signed, tamper-evident evidence of every decision.",
  },
  {
    q: "Can I self-host RaksHex?",
    a: "Docker Compose files ship in the repo for running the stack on your own infrastructure. The managed control plane is the primary private-beta offering — tell us about your environment when you join the waitlist.",
  },
  {
    q: "How do I get access?",
    a: "RaksHex is in private beta. Join the waitlist or use an invite to evaluate. Evaluation prices may be shown for planning. Paid access is by invite or Order Form only — there is no self-serve checkout this week.",
  },
  {
    q: "How do I evaluate RaksHex?",
    a: "RaksHex is in private beta. There is no self-serve trial or checkout. Join the waitlist to request access; invited teams receive a scoped evaluation workspace.",
  },
  {
    q: "Is there a paid Pro plan I can buy online?",
    a: "Not this week. Evaluation prices may be shown, but we cannot take money and there is no self-serve checkout, tax/GST collection, or auto-renewal. Paid access, if and when offered, is by invite or an executed Order Form.",
  },
  {
    q: "Can I export decision evidence?",
    a: "Yes. Export receipts and workspace audit events as JSON, CSV, NDJSON, or PDF — including signed receipt bundles with hash-chain verification you can hand to auditors.",
  },
  {
    q: "Is there a GitHub Action?",
    a: "Yes. Rakshex Security Scan runs on pull requests and checks your OpenAPI spec or Postman collection for OWASP API issues and cost anomalies.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-transparent text-white py-24 px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 font-display text-blue-500">
          Frequently Asked Questions
        </h1>
        <p className="text-gray-400 mb-12 font-mono text-sm">
          Everything you need to know about RaksHex. Can't find your question?{" "}
          <Link
            href="mailto:support@rakshex.in"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Email us
          </Link>
          .
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-black/50 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                <h2 className="font-bold text-lg mb-3 text-blue-400">{faq.q}</h2>
                <p className="text-gray-300 text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
