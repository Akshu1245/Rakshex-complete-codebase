import Link from "next/link";

export const metadata = {
  title: "HIPAA-Aligned AI Governance for Healthcare — RaksHex",
  description:
    "RaksHex helps healthcare teams govern PHI inside AI context windows, supporting HIPAA compliance programs and auditing diagnostic model behavior.",
  alternates: { canonical: "/solutions/healthcare" },
};

export default function HealthcareSolutionPage() {
  const painPoints = [
    {
      title: "PHI inside LLM contexts",
      desc: "Patient names, insurance credentials, and medical conditions must never be stored on provider logs or public models. RaksHex redacts PHI data in real time.",
    },
    {
      title: "HIPAA Audit Trails",
      desc: "Healthcare providers must maintain complete, tamper-evident audit logs of all agent actions on patient data. RaksHex's hash-chained Action Ledger records every authorization decision to support your compliance program.",
    },
    {
      title: "Uncontrolled Agent Actions",
      desc: "Autonomous clinical or administrative agents shouldn't be able to take high-risk actions — updating records, sending communications — without explicit, scoped authority. RaksHex evaluates each action against delegated authority before it executes.",
    },
  ];

  const exampleWorkflows = [
    {
      company: "Example: Telehealth summarization tool",
      title: "Masking PHI in Patient Summarization Tools",
      challenge:
        "An agent summarizing doctor-patient calls risks patient addresses and record IDs leaking to external API provider logs.",
      solution:
        "Route the workflow through RaksHex's PHI egress filter so diagnostic codes, addresses, and ID patterns are masked before they reach the model.",
      result:
        "Produces an auditable control trail; the customer must validate coverage for its own data and workflows.",
    },
    {
      company: "Example: Clinical research RAG bot",
      title: "Auditing Access to Clinical Trial Data",
      challenge:
        "A RAG workflow querying clinical trial records needs a defensible trail of who accessed which patient vectors, for internal and external review.",
      solution:
        "RaksHex's Action Ledger records each authorization decision in a hash-chained, tamper-evident log mapped to the requesting identity and resource.",
      result:
        "Supports evidence collection for a compliance audit; it does not certify HIPAA compliance on its own.",
    },
    {
      company: "Example: Radiology reporting assistant",
      title: "Flagging Anomalous Diagnostic Recommendations",
      challenge:
        "A reporting tool that hallucinates scan conclusions can introduce anomalous findings into patient charts before a clinician reviews them.",
      solution:
        "Require human sign-off as a scoped authorization step for any output routed to a patient chart, enforced at the action layer rather than left to model behavior.",
      result: "Outcomes depend on the model, workflow, and review policy the customer configures.",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-24 px-4 font-sans">
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
            HIPAA-Aligned AI Governance
          </h1>
          <p className="text-slate-400 text-lg mt-3">
            Govern PHI in agent workflows, keep a tamper-evident audit trail to support your HIPAA
            compliance program, and gate high-risk clinical actions behind explicit authorization.
          </p>
        </header>

        {/* Pain points */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Healthcare AI Challenges
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {painPoints.map((pt) => (
              <div
                key={pt.title}
                className="p-6 bg-slate-900/30 border border-slate-905 rounded-xl"
              >
                <h3 className="font-bold text-white text-base mb-2">{pt.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Example Workflows */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Example Control Workflows
          </h2>
          <div className="space-y-6">
            {exampleWorkflows.map((cs) => (
              <div
                key={cs.company}
                className="p-8 bg-slate-900/10 border border-slate-900 rounded-xl hover:border-slate-800 transition-colors"
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
        <div className="text-center bg-slate-900/30 border border-slate-900 p-8 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-2">
            Talk to us about your healthcare workflows
          </h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Walk through how RaksHex can govern PHI-handling agent actions in your environment.
          </p>
          <Link
            href="/demo"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 px-8 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  );
}
