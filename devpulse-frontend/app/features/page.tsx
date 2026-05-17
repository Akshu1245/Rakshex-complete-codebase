import Link from "next/link";

export const metadata = {
  title: "Features — DevPulse AI Runtime Governance",
  description:
    "Complete feature breakdown of DevPulse: AI security scanning, LLM cost monitoring, compliance automation, shadow API detection, kill switch, and enterprise SSO.",
  alternates: { canonical: "/features" },
};

const FEATURES = [
  {
    category: "Security",
    items: [
      {
        title: "Prompt Injection Detection",
        desc: "87-payload library detecting indirect prompt injection, jailbreak attempts, and system prompt leakage. Updated weekly with new attack vectors.",
      },
      {
        title: "API Vulnerability Scanner",
        desc: "BOLA/IDOR detection, insecure HTTP methods, missing auth, CORS misconfigurations, rate limit bypass testing. OWASP API Top 10 mapped.",
      },
      {
        title: "Secret Scanning",
        desc: "10-rule detection for AWS, GitHub, OpenAI, Anthropic, Stripe, Slack, JWT, and private keys. Includes Aadhaar and PAN for India compliance.",
      },
      {
        title: "Shadow API Discovery",
        desc: "Static route extraction for Express, FastAPI, Flask, Django, Spring Boot, Laravel. No production traffic needed.",
      },
      {
        title: "PII Redaction",
        desc: "Real-time redaction of emails, phone numbers, SSNs, credit cards, and Indian ID numbers before data leaves your infrastructure.",
      },
    ],
  },
  {
    category: "Cost Governance",
    items: [
      {
        title: "Per-Request Cost Tracking",
        desc: "Track every LLM token across OpenAI, Anthropic, Gemini, Cohere, Mistral, and Groq. Includes reasoning token isolation.",
      },
      {
        title: "Holt-Winters Forecasting",
        desc: "Predict next 30 days of spend with 95% confidence intervals. Detect seasonality and trend shifts automatically.",
      },
      {
        title: "Anomaly Detection",
        desc: "Statistical anomaly detection flags unusual spend patterns. Alert when daily variance exceeds 3 standard deviations.",
      },
      {
        title: "Autonomous Kill Switch",
        desc: "Circuit breaker that blocks all LLM calls when budget, anomaly threshold, or red-team score triggers. Sub-second response.",
      },
      {
        title: "Thinking Token Attribution",
        desc: "First-in-world isolation of reasoning tokens (o1, o3, Claude). Patent NHCE/DEV/2026/002. Exact cost per reasoning step.",
      },
    ],
  },
  {
    category: "Compliance",
    items: [
      {
        title: "SOC 2 Evidence Builder",
        desc: "Auto-generate evidence for all 5 Trust Services Criteria. Map findings to controls. Export for Vanta/Drata import.",
      },
      {
        title: "PCI DSS v4.0.1 Mapping",
        desc: "47 controls mapped to API security findings. Requirement 6.5, 11.3, and 6.4 coverage with remediation guidance.",
      },
      {
        title: "OWASP Compliance Scoring",
        desc: "Real-time score for OWASP API Top 10 and LLM Top 10. Track improvement over time with trend analysis.",
      },
      {
        title: "Audit Log Export",
        desc: "Immutable audit logs with tamper-proof hashing. Export as JSON, CSV, or PDF. 7-year retention for enterprise.",
      },
      {
        title: "GDPR / DPDP Act Support",
        desc: "Data subject request handling, right to erasure, consent tracking, and cross-border transfer documentation.",
      },
    ],
  },
  {
    category: "Developer Experience",
    items: [
      {
        title: "VS Code Extension",
        desc: "Scan collections, view findings, and trigger kill switch from your editor. Inline security warnings as you code.",
      },
      {
        title: "GitHub Action",
        desc: "PR comments with severity badges, exact endpoint names, one-line fixes, and cost impact in USD + INR.",
      },
      {
        title: "JavaScript SDK",
        desc: "One-line integration: `import { DevPulse } from '@devpulse/sdk'`. Automatic request interception and cost tracking.",
      },
      {
        title: "Python SDK",
        desc: "Drop-in middleware for FastAPI, Flask, Django. Async-first design with zero blocking on the hot path.",
      },
      {
        title: "Express.js Middleware",
        desc: `app.use(devPulse.middleware()) — automatic route discovery, secret scanning, and cost attribution.`,
      },
    ],
  },
  {
    category: "Enterprise",
    items: [
      {
        title: "SAML 2.0 + OIDC SSO",
        desc: "Okta, Google Workspace, Microsoft Entra, Azure AD, OneLogin. JIT provisioning and 4-role RBAC.",
      },
      {
        title: "Team Workspaces",
        desc: "Isolated workspaces with shared collections, role-based access, and per-team budget caps.",
      },
      {
        title: "Custom Data Retention",
        desc: "Configure retention from 30 days to 7 years per workspace. Automated archival and deletion workflows.",
      },
      {
        title: "Priority Support",
        desc: "4-hour SLA for Enterprise. Dedicated Slack channel, quarterly business reviews, and custom onboarding.",
      },
      {
        title: "Private Cloud Deploy",
        desc: "Self-hosted option with Docker Compose, Kubernetes Helm chart, or AWS/Azure/GCP marketplace deployment.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero */}
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Every Feature You Need to Govern AI</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          One platform. Five modules. Zero stitching. From security scanning to compliance export —
          everything is here.
        </p>
      </div>

      {/* Features by Category */}
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
                  className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors"
                >
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
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
