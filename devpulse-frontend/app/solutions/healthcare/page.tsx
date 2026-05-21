import Link from "next/link";

export const metadata = {
  title: "AI Security for Healthcare — Rakshex",
  description:
    "Rakshex helps healthcare organizations secure AI agents, protect PHI, and comply with HIPAA. Built for hospitals, clinics, and healthtech.",
  alternates: { canonical: "/solutions/healthcare" },
};

export default function HealthcarePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-20 px-4">
        <div className="text-center mb-16">
          <span className="text-green-400 text-sm font-medium uppercase tracking-wide">
            Solution
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-4">AI Security for Healthcare</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Protect patient data, secure medical AI models, and comply with HIPAA and India's DPDP
            Act. Built for hospitals, telemedicine platforms, and healthtech startups.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {[
            {
              title: "PHI Protection",
              desc: "Automatic redaction of patient names, medical record numbers, insurance IDs, and diagnostic codes before any data reaches LLM providers. Zero PHI leakage.",
            },
            {
              title: "HIPAA Compliance",
              desc: "Audit trails for every AI interaction. Access controls, encryption at rest and in transit, Business Associate Agreement (BAA) support.",
            },
            {
              title: "Medical Device Security",
              desc: "Scan APIs in connected medical devices and telemedicine platforms. Detect vulnerable endpoints in patient monitoring systems.",
            },
            {
              title: "AI Diagnostic Governance",
              desc: "Monitor LLM costs for diagnostic AI tools. Set budgets per department (radiology, pathology, cardiology). Prevent runaway inference costs.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold text-lg mb-2 text-blue-400">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/demo"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Schedule Healthcare Demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
