import Link from "next/link";

export const metadata = {
  title: "HIPAA-Ready AI Governance for Healthcare — RakshEx",
  description:
    "RakshEx secures patient health information (PHI) inside AI context windows, ensuring HIPAA compliance and auditing diagnostic model hallucinations.",
  alternates: { canonical: "/solutions/healthcare" },
};

export default function HealthcareSolutionPage() {
  const painPoints = [
    {
      title: "PHI inside LLM contexts",
      desc: "Patient names, insurance credentials, and medical conditions must never be stored on provider logs or public models. RakshEx redacts PHI data in real time.",
    },
    {
      title: "HIPAA Audit Trails",
      desc: "Healthcare providers must maintain complete, immutable audit logs of all user queries and model outputs. RakshEx records security metadata to verify compliance.",
    },
    {
      title: "Model Hallucination Risks",
      desc: "Non-deterministic AI outputs can yield wrong medical suggestions or wrong dosages. RakshEx flags anomalies and provides output boundaries.",
    },
  ];

  const caseStudies = [
    {
      company: "CareHealth (Telehealth)",
      title: "Masking PHI in Patient Summarization Tools",
      challenge:
        "CareHealth deployed an agent to summarize doctor-patient calls. However, doctors mentioned patient addresses and record IDs, which leaked to public API provider logs.",
      solution:
        "CareHealth integrated RakshEx's real-time PII/PHI egress filter. All diagnostic codes, addresses, and ID patterns are automatically masked before LLM ingestion.",
      result:
        "Zero patient identifiers leaked to third parties, maintaining absolute confidentiality.",
    },
    {
      company: "MedScout (Research)",
      title: "HIPAA Auditing for Clinical Trials",
      challenge:
        "MedScout built a RAG bot to query clinical trials. To satisfy HIPAA auditors, they needed a comprehensive audit trail of who accessed which patient vectors.",
      solution:
        "RakshEx generated end-to-end audit reports mapping queries to vector databases, resolving security metadata into reports.",
      result:
        "Passed HIPAA audit with flying colors, proving 100% control over patient data access.",
    },
    {
      company: "RadiologyAI (Diagnostics)",
      title: "Preventing Hallucinations in Radiology Recommendations",
      challenge:
        "RadiologyAI's reporting tool hallucinated scan conclusions, generating anomalous findings in critical patient charts.",
      solution:
        "By routing completions through RakshEx's diagnostic validation engine, any output containing critical semantic mismatch alerts was automatically flagged for human review.",
      result: "99% reduction in model recommendation anomalies before doctor signoff.",
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/60 mb-4">
            🩺 Healthcare & Life Sciences
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            HIPAA-Ready AI Governance
          </h1>
          <p className="text-slate-400 text-lg mt-3">
            Redact PHI patterns, compile HIPAA-compliant audit logs, and monitor model
            recommendations for hallucination risks.
          </p>
        </header>

        {/* Pain points */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Healthcare AI Challenges
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

        {/* Case Studies */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Healthcare Case Studies
          </h2>
          <div className="space-y-6">
            {caseStudies.map((cs) => (
              <div
                key={cs.company}
                className="p-8 bg-slate-900/10 border border-slate-900 rounded-2xl hover:border-slate-800 transition-colors"
              >
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                  {cs.company}
                </span>
                <h3 className="text-xl font-bold text-white mb-4">{cs.title}</h3>
                <div className="grid md:grid-cols-3 gap-6 text-xs text-slate-400">
                  <div>
                    <strong className="text-slate-300 block mb-1 font-semibold">
                      The Challenge:
                    </strong>
                    {cs.challenge}
                  </div>
                  <div>
                    <strong className="text-slate-300 block mb-1 font-semibold">
                      The Solution:
                    </strong>
                    {cs.solution}
                  </div>
                  <div>
                    <strong className="text-slate-300 block mb-1 font-semibold">The Result:</strong>
                    <span className="text-emerald-400">{cs.result}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center bg-slate-900/30 border border-slate-900 p-8 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Secure your healthcare APIs</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Run a sandbox scan of your healthcare API specs to audit compliance risks immediately.
          </p>
          <Link
            href="/demo"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 px-8 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Start Free Demo Scan
          </Link>
        </div>
      </div>
    </div>
  );
}
