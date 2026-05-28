import Link from "next/link";

export const metadata = {
  title: "Trust Center — RakshEx Security & Compliance",
  description:
    "RakshEx trust center: security architecture, data handling, patents, encryption standards, and incident response disclosures.",
  alternates: { canonical: "/trust" },
};

export default function TrustCenter() {
  const patents = [
    { id: "NHCE/DEV/2026/001", name: "AI Runtime Governance Framework", desc: "Covers our core interceptor middleware, checking and blocking payloads at the API level before they reach frontier models." },
    { id: "NHCE/DEV/2026/002", name: "LLM Cost Attribution Engine", desc: "A method of parsing reasoning metadata to trace thinking tokens back to features, sessions, and individual customer keys." },
    { id: "NHCE/DEV/2026/003", name: "AgentGuard Kill Switch System", desc: "An autonomous circuit breaker system monitoring agentic tool invocation rates and locking compromised connections." },
    { id: "NHCE/DEV/2026/004", name: "Prompt Injection Detection Engine", desc: "Classifies prompt semantics using dynamic vector mapping and heuristics to block adversarial instructions." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/60 mb-4">
            🛡️ Certified & Secure
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Trust Center
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg mt-3">
            Security and privacy are the foundation of our AI runtime governance platform. Learn how we handle your data, protect your keys, and secure model integrations.
          </p>
        </header>

        <div className="space-y-12">
          {/* Section 1: Data Handling */}
          <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-blue-400">01.</span> Data Handling
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-white text-base mb-2">What data we collect</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  RakshEx only collects API metadata (endpoint paths, request methods, header structures, and cost telemetry). 
                  <strong> We never store raw prompt payloads or completions</strong>. Payloads are processed inside volatile memory at runtime for validation and then immediately discarded.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base mb-2">Where it is stored</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  All metrics, settings, and metadata are stored in a secure PostgreSQL/MySQL database hosted on AWS/Render. Enterprise customers can choose custom geographic locations for data residency (including India, EU, and US).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base mb-2">Retention policy</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  By default, data is retained for 30 days on our Free tier and 1 year on our Pro tier. Enterprise accounts can define custom retention policies up to 7 years with automated purging.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base mb-2">No training on customer data</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We have a strict policy: **we never train our models or classification engines** on your API keys, prompts, metadata, or telemetry logs. Your data remains strictly yours.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Security Practices */}
          <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-blue-400">02.</span> Security Practices
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-slate-900 p-5 rounded-xl bg-slate-950/40">
                <h4 className="font-semibold text-slate-200 mb-1">TLS 1.3 in Transit</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All network communication between your servers, the RakshEx portal, and LLM endpoints is encrypted using TLS 1.3. Unencrypted HTTP requests are automatically rejected.
                </p>
              </div>
              <div className="border border-slate-900 p-5 rounded-xl bg-slate-950/40">
                <h4 className="font-semibold text-slate-200 mb-1">AES-256 at Rest</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All databases and storage volumes are encrypted using military-grade AES-256-GCM. Master encryption keys are rotated periodically.
                </p>
              </div>
              <div className="border border-slate-900 p-5 rounded-xl bg-slate-950/40">
                <h4 className="font-semibold text-slate-200 mb-1">SOC 2 Type II</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our system architecture is designed from the ground up to support SOC 2 controls. We are currently **In Progress** for our SOC 2 Type II audit.
                </p>
              </div>
              <div className="border border-slate-900 p-5 rounded-xl bg-slate-950/40">
                <h4 className="font-semibold text-slate-200 mb-1">Penetration Tested</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We run automated vulnerability scans weekly. Our next external white-box penetration test is **Scheduled for Q3 2026**.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Compliance */}
          <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-blue-400">03.</span> Compliance
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="bg-blue-950 text-blue-400 text-xs px-2.5 py-1 rounded font-bold border border-blue-900/60 uppercase">OWASP AI</span>
                <div>
                  <h4 className="font-semibold text-white text-sm">OWASP AI Top 10 Aligned</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Our scanner engine maps security vulnerabilities directly to the latest OWASP Top 10 for LLM Applications guidelines, covering prompt injection, insecure output handling, and excessive agency.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="bg-purple-950 text-purple-400 text-xs px-2.5 py-1 rounded font-bold border border-purple-900/60 uppercase">DPDP</span>
                <div>
                  <h4 className="font-semibold text-white text-sm">DPDP Act 2023 (India) Compliant</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    We strictly follow India's Digital Personal Data Protection Act guidelines. We support comprehensive consent logs, user data deletion requests, and local hosting in India region nodes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="bg-emerald-950 text-emerald-400 text-xs px-2.5 py-1 rounded font-bold border border-emerald-900/60 uppercase">GDPR</span>
                <div>
                  <h4 className="font-semibold text-white text-sm">GDPR Ready</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    We process all customer information in compliance with EU GDPR regulations. Data Processing Agreements (DPA) incorporating Standard Contractual Clauses (SCC) are available for all customers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Patents */}
          <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-blue-400">04.</span> Provisional Patents
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              RakshEx’s underlying technologies are backed by four provisional patents filed in 2026:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {patents.map((pat) => (
                <div key={pat.id} className="p-5 border border-slate-850 rounded-xl bg-slate-950/20">
                  <span className="text-xs font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/40">{pat.id}</span>
                  <h4 className="font-bold text-white text-sm mt-3">{pat.name}</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">{pat.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Disclosures & Contact */}
          <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Report a Vulnerability</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto mb-6">
              We value the contributions of security researchers. If you identify a security gap or vulnerability in RakshEx services, please contact our security team for coordinated disclosure.
            </p>
            <a
              href="mailto:security@rakshex.in"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-3 px-6 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              security@rakshex.in Disclosures
            </a>
          </section>
        </div>

        <footer className="mt-16 border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RakshEx. All rights reserved. SOC 2, ISO 27001, and patents pending.</p>
        </footer>
      </div>
    </div>
  );
}
