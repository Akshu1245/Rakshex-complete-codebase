import Link from "next/link";

export const metadata = {
  title: "Enterprise-Grade AI Runtime Governance — RaksHex",
  description:
    "RaksHex Enterprise offers single sign-on (SSO), 4-hour SLA agreements, dedicated Slack support channels, and custom rules for AI deployments at scale.",
  alternates: { canonical: "/solutions/enterprise" },
};

export default function EnterpriseSolutionPage() {
  const painPoints = [
    {
      title: "Multi-Team Agent Sprawl",
      desc: "Corporate teams spin up dozens of autonomous agents independently, leading to unmonitored shadow APIs and fragmented security policies. RaksHex unifies visibility.",
    },
    {
      title: "Compliance Reporting at Scale",
      desc: "Enterprise audits require mapping all model behaviors to security frameworks like SOC 2, ISO 27001, and local guidelines. RaksHex compiles centralized evidence.",
    },
    {
      title: "LLM Costs & Token Leakage",
      desc: "Runaway reasoning loops and duplicate prompts by internal teams create massive, unchecked developer bills. RaksHex sets granular budget limits.",
    },
  ];

  const enterpriseFeatures = [
    {
      title: "Enterprise Single Sign-On (SSO)",
      desc: "Integrate Okta, Google Workspace, Azure AD, or Microsoft Entra using SAML 2.0 or OIDC. Supports JIT provisioning and role-based access control (RBAC).",
    },
    {
      title: "4-Hour SLA & Custom Support",
      desc: "SLA response guarantees for critical production incidents. Access to a dedicated Slack channel with our security engineering team.",
    },
    {
      title: "Custom Prompt Rules & Guardrails",
      desc: "Build tailored security policies, custom regex patterns, and specific prompt boundaries mapping to your business needs.",
    },
    {
      title: "Self-Hosted Cloud Options",
      desc: "Deploy RaksHex on-premise or within your private AWS/Azure/GCP clouds using our Kubernetes Helm charts and Docker containers.",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-blue-400 mb-6">
          <Link href="/" className="hover:underline">
            ← Back to Home
          </Link>
        </nav>

        {/* Hero */}
        <header className="mb-16 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950 text-purple-400 border border-purple-900/60 mb-4">
            🏢 Corporate & Scale Governance
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Enterprise-Grade AI Governance
          </h1>
          <p className="text-slate-400 text-lg mt-3">
            Govern multi-team agent deployments, generate automated compliance audits, and enforce
            runtime guardrails globally.
          </p>
        </header>

        {/* Pain points */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Enterprise Pain Points
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((pt) => (
              <div
                key={pt.title}
                className="p-6 bg-slate-900/30 border border-slate-905 rounded-2xl"
              >
                <h3 className="font-bold text-white text-base mb-2">{pt.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Enterprise Capabilities
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {enterpriseFeatures.map((feat) => (
              <div
                key={feat.title}
                className="p-6 bg-slate-900/10 border border-slate-900 rounded-2xl hover:bg-slate-900/20 transition-all"
              >
                <h3 className="font-bold text-slate-200 text-base mb-2">{feat.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Info */}
        <div className="bg-slate-900/30 border border-slate-900 p-8 rounded-2xl mb-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Flexible Enterprise Engagements</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Our pricing is designed to scale with your API call volume. Speak to our founding team
            to request a custom security SLA.
          </p>
          <a
            href="mailto:akshay@devpulse.ai?subject=RakshEx Enterprise Inquiry"
            className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm py-3 px-8 rounded-lg transition-colors shadow-lg shadow-purple-500/20"
          >
            Contact akshay@devpulse.ai
          </a>
        </div>
      </div>
    </div>
  );
}
