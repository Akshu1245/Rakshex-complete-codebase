import Link from "next/link";

export const metadata = {
  title: "Features — RaksHex AI Runtime Governance",
  description:
    "Feature breakdown of RaksHex: API security scanning, LLM cost monitoring, compliance scoring, shadow API detection, kill switch, and workspace controls.",
  alternates: { canonical: "/features" },
};

const FEATURES = [
  {
    category: "Security",
    items: [
      {
        title: "Prompt Injection Detection",
        desc: "Payload library covering common jailbreaks, indirect injection, and system-prompt leakage patterns. Continuously expanded as new attack vectors appear.",
      },
      {
        title: "API Vulnerability Scanner",
        desc: "BOLA/IDOR heuristics, insecure HTTP methods, missing auth, CORS misconfigurations. Findings mapped to OWASP API Top 10 where applicable.",
      },
      {
        title: "Secret Scanning",
        desc: "Detects common cloud and LLM credentials (AWS, GitHub, OpenAI, Anthropic, Stripe, Slack, JWT, private keys) plus India-specific ID patterns.",
      },
      {
        title: "Shadow API Discovery",
        desc: "Static route extraction for popular frameworks from imported collections and source patterns — without requiring production traffic.",
      },
      {
        title: "PII Redaction (gateway path)",
        desc: "Redaction helpers for emails, phone numbers, and common ID formats on supported gateway paths. Coverage depends on deployment configuration.",
      },
    ],
  },
  {
    category: "Cost Governance",
    items: [
      {
        title: "Per-Request Cost Tracking",
        desc: "Track token usage and estimated spend across supported LLM providers when traffic flows through the RakshEx gateway or instrumented paths.",
      },
      {
        title: "Spend Forecasting",
        desc: "Trend and forecast views for upcoming spend based on recent usage — confidence bands improve with more history.",
      },
      {
        title: "Anomaly Detection",
        desc: "Flags unusual spend patterns relative to your recent baseline so teams can investigate spikes early.",
      },
      {
        title: "Autonomous Kill Switch",
        desc: "Circuit breaker that blocks LLM calls when budget or policy thresholds trip. Response time depends on your deployment topology.",
      },
      {
        title: "Thinking Token Attribution",
        desc: "Separates reasoning/thinking tokens where providers expose them so cost reports stay accurate for o-series and similar models.",
      },
    ],
  },
  {
    category: "Compliance",
    items: [
      {
        title: "SOC 2-oriented Evidence Packs",
        desc: "Generate structured evidence exports mapped to common Trust Services themes. Not a SOC 2 certification and not a Vanta/Drata connector.",
      },
      {
        title: "PCI DSS Control Mapping",
        desc: "Maps relevant API-security findings to PCI DSS control language for remediation guidance. Does not claim PCI attestation.",
      },
      {
        title: "OWASP Compliance Scoring",
        desc: "Score views for OWASP API Top 10 and LLM Top 10 based on your scan findings and trend over time.",
      },
      {
        title: "Audit Log Export",
        desc: "Export workspace audit events as JSON/CSV for your GRC tooling. Retention policies are plan- and deployment-dependent.",
      },
      {
        title: "Privacy Controls",
        desc: "Tools to support GDPR/DPDP-oriented workflows (export/erasure paths). Legal compliance remains the customer’s responsibility.",
      },
    ],
  },
  {
    category: "Developer Experience",
    items: [
      {
        title: "VS Code Extension",
        desc: "Scan collections and review findings from the editor when the published extension is installed and authenticated.",
      },
      {
        title: "GitHub App + PR Comments",
        desc: "Webhook-driven PR scans with findings posted as pull-request comments when the GitHub App is installed.",
      },
      {
        title: "HTTP / tRPC API",
        desc: "Programmatic access to collections, scans, and findings via the RakshEx API. Dedicated public SDKs are on the roadmap.",
      },
      {
        title: "OpenAPI / Postman Import",
        desc: "Import OpenAPI, Postman, and Bruno collections to kick off security scans without rewriting your specs.",
      },
      {
        title: "Webhook Notifications",
        desc: "Lifecycle webhooks (scan, finding, quota, kill-switch) plus Slack when configured. Manage endpoints in Settings → Webhooks.",
      },
    ],
  },
  {
    category: "Enterprise",
    items: [
      {
        title: "SSO (SAML / OIDC)",
        desc: "Configure OIDC or SAML providers in Settings → SSO. Enable after verifying IdP settings; plan entitlements may apply.",
      },
      {
        title: "Team Workspaces",
        desc: "Shared workspaces with role-based access for collections, scans, and billing boundaries.",
      },
      {
        title: "Configurable Retention",
        desc: "Retention and export controls for scan and audit data based on your workspace settings.",
      },
      {
        title: "Priority Support",
        desc: "Higher-touch support options for Enterprise agreements (SLA details in your contract).",
      },
      {
        title: "Self-Hosted Deploy",
        desc: "Docker Compose and container-based self-host paths for teams that need to run RakshEx in their own cloud.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Features that ship with RakshEx</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Honest product surface: security scanning, cost governance, compliance scoring, and
          GitHub/Slack integrations that are available today — without claiming unshipped
          certifications or connectors.
        </p>
      </div>

      <div className="max-w-6xl mx-auto py-16 px-4 space-y-20">
        {FEATURES.map((section) => (
          <section key={section.category}>
            <h2 className="text-2xl font-bold text-blue-400 mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-blue-500 rounded-full" />
              {section.category}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.items.map((item) => (
                <div
                  key={item.title}
                  className="bg-black/50 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors"
                >
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="text-center py-16 border-t border-gray-800">
        <h2 className="text-2xl font-bold mb-4">Ready to see it in action?</h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/demo"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Try Live Demo →
          </Link>
          <Link
            href="/pricing"
            className="border border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-medium hover:border-gray-400 transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
