import Link from "next/link";
import { ArrowRight, Building2, Landmark, HeartPulse } from "lucide-react";

export const metadata = {
  title: "Industry Solutions — RaksHex",
  description:
    "Explore how RaksHex secures AI across Enterprise, Fintech, and Healthcare industries.",
  alternates: { canonical: "/solutions" },
};

const solutions = [
  {
    id: "enterprise",
    title: "Enterprise",
    description:
      "SSO, RBAC, audit trails, and custom guardrails for large-scale AI deployments across multiple teams.",
    icon: Building2,
    href: "/solutions/enterprise",
    features: ["SAML / OIDC SSO", "4-Hour SLA", "Custom Policies", "Self-Hosted Option"],
  },
  {
    id: "fintech",
    title: "Fintech",
    description:
      "PCI-DSS compliance, real-time fraud detection, and cost governance for financial AI agents.",
    icon: Landmark,
    href: "/solutions/fintech",
    features: ["PCI-DSS Mapping", "Fraud Detection", "Cost Attribution", "Audit Logs"],
  },
  {
    id: "healthcare",
    title: "Healthcare",
    description:
      "HIPAA-aligned data handling, PHI redaction, and clinical AI safety monitoring at scale.",
    icon: HeartPulse,
    href: "/solutions/healthcare",
    features: ["PHI Redaction", "HIPAA Alignment", "Clinical Safety", "Model Drift"],
  },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 font-manrope">
            Solutions by Industry
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Every industry faces unique AI risks. RaksHex is tailored to meet the compliance,
            security, and cost challenges specific to your sector.
          </p>
        </div>

        {/* Solution Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {solutions.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.id}
                href={s.href}
                className="group block bg-black/50 rounded-2xl border border-neutral-800 p-6 hover:border-[#14B8A6]/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#14B8A6]" />
                </div>
                <h2 className="text-xl font-semibold mb-2 group-hover:text-[#14B8A6] transition-colors">
                  {s.title}
                </h2>
                <p className="text-neutral-400 text-sm leading-relaxed mb-5">{s.description}</p>
                <ul className="space-y-2 mb-6">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-neutral-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 text-sm text-[#14B8A6] font-medium group-hover:gap-3 transition-all">
                  Learn more <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center bg-black/50 rounded-2xl border border-neutral-800 p-10">
          <h2 className="text-2xl font-bold mb-3">Not sure which fits you?</h2>
          <p className="text-neutral-400 mb-6 max-w-lg mx-auto">
            Talk to our team and get a tailored assessment of your AI security posture.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#14B8A6] to-[#2dd4bf] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              Book a demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-black/50 border border-neutral-700 text-white font-medium hover:border-[#14B8A6]/40 transition-colors"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
