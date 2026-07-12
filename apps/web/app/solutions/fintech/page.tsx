import Link from "next/link";

export const metadata = {
  title: "AI Security for Fintech APIs — RaksHex",
  description:
    "RaksHex secures financial services AI applications, ensuring PCI-DSS compliance, real-time fraud prevention, and thinking token cost governance.",
  alternates: { canonical: "/solutions/fintech" },
};

export default function FintechSolutionPage() {
  const painPoints = [
    {
      title: "PCI-DSS Compliance",
      desc: "Regulated financial platforms must ensure cardholder data (CHD) and sensitive authentication data (SAD) never leaks to external LLM provider environments. RaksHex redacts sensitive info at the API level.",
    },
    {
      title: "Real-time Fraud Detection in AI Agents",
      desc: "Autonomous financial agents can be manipulated via prompt injection to transfer funds or override transaction thresholds. RaksHex monitors tool parameters in real time.",
    },
    {
      title: "LLM Cost Attribution at Scale",
      desc: "High-volume transactional LLM calls create massive cloud spend. RaksHex tracks cost attribution per feature, model, and user session.",
    },
  ];

  const exampleWorkflows = [
    {
      company: "Example: Retail banking assistant",
      title: "Mitigating Prompt Injections in AI Chatbots",
      challenge:
        "A customer support agent with account API access needs controls against prompt injections and unauthorised transfer attempts.",
      solution:
        "Route governed requests through policy checks and place high-value tools behind approval and budget controls.",
      result:
        "Produces an auditable control trail; the customer must validate effectiveness in its own environment.",
    },
    {
      company: "Example: Regulated RAG workflow",
      title: "Securing Underwriting RAG Pipelines",
      challenge:
        "A RAG workflow may contain personal, financial, or regulated records that should not reach an external model unchecked.",
      solution:
        "Use data-redaction, model allowlists, private relay, and retention controls appropriate to the data class and provider.",
      result:
        "Supports evidence collection; it does not certify legal compliance or guarantee zero leakage.",
    },
    {
      company: "Example: High-volume agent workflow",
      title: "Optimizing High-Volume Trading LLM Costs",
      challenge:
        "A recursive or misconfigured agent can generate unexpected provider spend and latency.",
      solution:
        "Use usage attribution, budget rules, rate limits, and an emergency kill switch to contain a runaway workload.",
      result: "Measures and savings depend on the provider, model, policy, and customer workload.",
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
            💳 Fintech & Banking Solution
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            AI Security for Fintech APIs
          </h1>
          <p className="text-slate-400 text-lg mt-3">
            Secure financial AI integrations, ensure PCI-DSS compliance, and control high-volume
            transaction costs.
          </p>
        </header>

        {/* Pain points */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
            Fintech Security Challenges
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
            Example Control Workflows
          </h2>
          <div className="space-y-6">
            {exampleWorkflows.map((cs) => (
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
          <h2 className="text-xl font-bold text-white mb-2">Ready to run a secure scan?</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Upload your financial API specs to detect credentials and vulnerabilities instantly.
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
