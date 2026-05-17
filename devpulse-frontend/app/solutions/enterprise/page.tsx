import Link from "next/link";

export const metadata = {
  title: "Enterprise AI Governance — DevPulse",
  description:
    "DevPulse Enterprise: SSO, RBAC, SOC 2 evidence, custom data retention, and 4-hour SLA. Secure AI at scale.",
  alternates: { canonical: "/solutions/enterprise" },
};

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-16">
          <span className="text-purple-400 text-sm font-medium uppercase tracking-wide">
            Solution
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-4">Enterprise AI Governance</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Deploy AI with confidence at scale. SSO, RBAC, SOC 2 evidence, custom retention, and
            dedicated support.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {[
            {
              title: "SSO & Identity",
              desc: "SAML 2.0 and OIDC with Okta, Google Workspace, Microsoft Entra, Azure AD, and OneLogin. JIT provisioning and 4-role RBAC (Owner, Admin, Analyst, Viewer).",
            },
            {
              title: "SOC 2 Evidence Builder",
              desc: "Auto-generate evidence for all 5 Trust Services Criteria. Map every security finding to a control. Export for Vanta, Drata, or Secureframe import.",
            },
            {
              title: "Custom Data Retention",
              desc: "Configure retention from 30 days to 7 years per workspace. Automated archival to S3-compatible storage. Deletion workflows with audit logs.",
            },
            {
              title: "Private Cloud Deploy",
              desc: "Self-hosted with Docker Compose or Kubernetes Helm chart. AWS, Azure, GCP, or on-premise. Air-gapped options available.",
            },
            {
              title: "Priority Support",
              desc: "4-hour SLA for critical issues. Dedicated Slack channel. Quarterly business reviews. Priority feature requests. Custom onboarding sessions.",
            },
            {
              title: "Advanced Analytics",
              desc: "Organization-wide security posture dashboard. Trend analysis over time. Executive summaries. Custom report scheduling.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold text-lg mb-2 text-purple-400">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 mb-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Enterprise Pricing</h2>
          <div className="text-4xl font-bold text-purple-400 mb-2">
            $499<span className="text-lg text-gray-400">/mo</span>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Starting price. Custom pricing for large deployments.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left text-sm">
            {[
              "SSO / SAML 2.0",
              "25 team members",
              "Priority support (4h SLA)",
              "SOC 2 evidence builder",
              "Custom data retention",
              "Private cloud option",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link
            href="mailto:enterprise@devpulse.in"
            className="inline-block bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Contact Enterprise Sales →
          </Link>
        </div>
      </div>
    </div>
  );
}
