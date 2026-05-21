import Link from "next/link";

export const metadata = {
  title: "AI Security for Fintech — Rakshex",
  description:
    "Rakshex helps fintech companies secure AI agents, comply with PCI DSS, and prevent API leaks. Built for regulated financial services.",
  alternates: { canonical: "/solutions/fintech" },
};

export default function FintechPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-16">
          <span className="text-green-400 text-sm font-medium uppercase tracking-wide">
            Solution
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-4">AI Security for Fintech</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Protect customer data, comply with PCI DSS, and prevent prompt injection in production
            AI agents. Built for banks, NBFCs, insurance, and payment processors.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {[
            {
              title: "PCI DSS v4.0.1 Compliance",
              desc: "Automated mapping of all 47 PCI controls. Requirement 6.5 (application security), 11.3 (penetration testing), and 6.4 (software security patches) covered out of the box.",
            },
            {
              title: "Customer Data Protection",
              desc: "Real-time PII redaction before data reaches LLM providers. PAN, Aadhaar, account numbers, and phone numbers masked automatically. No data leakage to third parties.",
            },
            {
              title: "API Security for Payment Rails",
              desc: "Scan every payment API endpoint for BOLA/IDOR vulnerabilities. Test UPI, NEFT, RTGS, and card processing endpoints. Find auth bypasses before attackers do.",
            },
            {
              title: "Budget Governance",
              desc: "Set per-department LLM budgets. Kill switch prevents runaway costs from customer service bots or fraud detection models. Track spend in INR and USD.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold text-lg mb-2 text-blue-400">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 mb-16">
          <h2 className="text-2xl font-bold mb-6">Why Fintechs Choose Rakshex</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { value: "₹0", label: "Data leakage risk with PII redaction" },
              { value: "4h", label: "SLA for critical security findings" },
              { value: "100%", label: "PCI DSS control coverage" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-green-400">{s.value}</div>
                <div className="text-gray-400 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/demo"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Schedule Fintech Demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
