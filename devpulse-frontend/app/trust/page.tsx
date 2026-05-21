import Link from "next/link";

export const metadata = {
  title: "Trust Center — Rakshex Security & Compliance",
  description:
    "Rakshex trust center: security architecture, compliance certifications, data handling, encryption, penetration testing, and incident response.",
  alternates: { canonical: "/trust" },
};

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero */}
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Trust Center</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Security is not a feature — it is the foundation. Learn how we protect your data,
          infrastructure, and AI agents.
        </p>
      </div>

      <div className="max-w-5xl mx-auto py-16 px-4 space-y-16">
        {/* Security Architecture */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Security Architecture</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-2">Encryption at Rest</h3>
              <p className="text-gray-400 text-sm">
                All data encrypted with AES-256-GCM. Database uses Transparent Data Encryption
                (TDE). Keys managed via environment variables, never committed to source control.
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-2">Encryption in Transit</h3>
              <p className="text-gray-400 text-sm">
                TLS 1.3 for all API traffic. HSTS with preload. Certificate pinning for SDK
                communications. No unencrypted HTTP allowed in production.
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-2">Secret Management</h3>
              <p className="text-gray-400 text-sm">
                API keys, JWT secrets, and database credentials stored as Render environment
                variables. No secrets in Docker images. No secrets in client-side bundles.
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-2">Network Isolation</h3>
              <p className="text-gray-400 text-sm">
                Backend services communicate via private Redis channels. Database not exposed to
                public internet. Webhook endpoints verify signatures (HMAC-SHA256) before
                processing.
              </p>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Compliance & Certifications</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="p-4 font-semibold">Standard</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {[
                  { std: "SOC 2 Type 1", status: "In Progress", coverage: "Planned Q3 2026" },
                  { std: "ISO 27001", status: "In Progress", coverage: "Planned Q4 2026" },
                  {
                    std: "PCI DSS v4.0.1",
                    status: "Controls Implemented",
                    coverage: "47 controls mapped",
                  },
                  {
                    std: "GDPR",
                    status: "Compliant",
                    coverage: "Privacy by design, DPA available",
                  },
                  {
                    std: "India DPDP Act",
                    status: "Compliant",
                    coverage: "Consent management, data localization",
                  },
                  {
                    std: "OWASP Top 10",
                    status: "Automated Testing",
                    coverage: "API + LLM variants",
                  },
                ].map((row) => (
                  <tr key={row.std}>
                    <td className="p-4 font-medium">{row.std}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          row.status === "Compliant"
                            ? "bg-green-900/50 text-green-400"
                            : row.status === "In Progress"
                              ? "bg-amber-900/50 text-amber-400"
                              : "bg-blue-900/50 text-blue-400"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{row.coverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Data Handling */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Data Handling</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "What We Store",
                desc: "Endpoint metadata (paths, methods, auth types), cost data, scan findings, user profiles. NO request/response bodies stored.",
              },
              {
                title: "Data Residency",
                desc: "Default: India (Bengaluru). Enterprise: Choose US-East, EU-West, or APAC-Singapore. Self-hosted: Your infrastructure.",
              },
              {
                title: "Retention",
                desc: "Free: 30 days. Pro: 1 year. Enterprise: Custom (up to 7 years). Automated deletion on expiry. Export before deletion.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Incident Response */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Incident Response</h2>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <ul className="space-y-3 text-gray-300 text-sm">
              <li className="flex gap-3">
                <span className="text-green-400 font-bold">P0</span>
                <span>
                  Critical — Acknowledged in 15 minutes, resolved in 4 hours. War room activated
                  automatically.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-bold">P1</span>
                <span>
                  High — Acknowledged in 1 hour, resolved in 24 hours. Customer notification within
                  30 minutes.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">P2</span>
                <span>
                  Medium — Acknowledged in 4 hours, resolved in 72 hours. Status page updated.
                </span>
              </li>
            </ul>
            <p className="text-gray-400 text-sm mt-4">
              Report security issues to{" "}
              <Link href="mailto:security@rakshex.in" className="text-blue-400 hover:underline">
                security@rakshex.in
              </Link>
              . We follow responsible disclosure with a 90-day fix commitment.
            </p>
          </div>
        </section>

        {/* Penetration Testing */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Penetration Testing</h2>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-gray-300 text-sm space-y-3">
            <p>
              <strong>Last external pentest:</strong> Scheduled Q3 2026 (pending vendor selection)
            </p>
            <p>
              <strong>Internal red team:</strong> Continuous. 87-payload adversarial testing library
              run weekly against staging.
            </p>
            <p>
              <strong>Bug bounty:</strong> Planned launch Q4 2026 on HackerOne.
            </p>
            <p>
              <strong>CI security:</strong> Every PR scanned for secrets, vulnerabilities, and
              dependency CVEs before merge.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center py-8">
          <h2 className="text-xl font-bold mb-4">Need our full security whitepaper?</h2>
          <Link
            href="mailto:security@rakshex.in?subject=Security Whitepaper Request"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Request Security Whitepaper →
          </Link>
        </div>
      </div>
    </div>
  );
}
