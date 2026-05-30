import Link from "next/link";

export default function SecurityWhitepaper() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto prose prose-invert">
        <p className="text-blue-400 text-sm font-medium mb-2">RaksHex Security</p>
        <h1 className="text-4xl font-bold mb-4">Security Architecture Whitepaper</h1>
        <p className="text-gray-400 mb-8">Last updated: May 2026 · 15 min read</p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Executive Summary</h2>
          <p className="text-gray-300 leading-relaxed">
            RaksHex is an AI Runtime Governance Platform that provides inline security scanning,
            cost monitoring, and compliance enforcement for production LLM applications. This
            document describes our security architecture, threat model, and the controls we
            implement to protect customer data.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">1. Threat Model</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            We protect against the following threat categories:
          </p>
          <div className="space-y-4">
            {[
              {
                title: "Prompt Injection (LLM01)",
                desc: "87-payload regex library with severity-tiered blocking. All user inputs to LLM endpoints are scanned before reaching the model.",
              },
              {
                title: "Insecure Output Handling (LLM02)",
                desc: "Response validation with JSON schema enforcement on tool calls. Blocked outputs never reach downstream systems.",
              },
              {
                title: "Sensitive Information Disclosure (LLM06)",
                desc: "12-rule PII redaction engine (credit cards, SSN, Aadhaar, PAN, email, phone) with Luhn and Verhoeff verification. Streaming output redaction for SSE responses.",
              },
              {
                title: "Insecure Plugin Design (LLM07)",
                desc: "MCP tool registry with risk scoring. Tools requiring network egress, file write, shell exec, or secret access are flagged and gated.",
              },
              {
                title: "Excessive Agency (LLM08)",
                desc: "Per-agent tool-call allowlists. Kill switch with sub-second trip time. Budget caps with hard enforcement.",
              },
              {
                title: "Model Theft (LLM10)",
                desc: "Request fingerprinting with SHA-256. Anomaly detection on request patterns. Rate limiting per tenant.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-blue-400 mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">2. Encryption & Key Management</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>Data in transit:</strong> TLS 1.3 enforced. HTTP Strict Transport Security
              (HSTS) with 1-year max-age and preload.
            </li>
            <li>
              <strong>Data at rest:</strong> AES-256-GCM with per-tenant key derivation.
              Authenticated encryption with AAD binding prevents cross-tenant access.
            </li>
            <li>
              <strong>Secrets:</strong> API keys stored server-side only, never logged. Pino
              structured logger with PII redaction. Sentry event scrubbing before egress.
            </li>
            <li>
              <strong>Passwords:</strong> PBKDF2-SHA512 with 100,000 iterations and per-user 32-byte
              salt. Never stored in plaintext.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">3. Authentication & Authorization</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>Session management:</strong> HTTP-only, SameSite=Lax, Secure cookies. CSRF
              double-submit cookie pattern. Session token rotation on password change.
            </li>
            <li>
              <strong>Multi-factor:</strong> TOTP-based 2FA with 6-digit codes. Verified at login
              and sensitive operations.
            </li>
            <li>
              <strong>SSO:</strong> SAML 2.0 with signed assertions. OpenID Connect with PKCE
              (S256). JIT provisioning with namespace-isolated subject IDs.
            </li>
            <li>
              <strong>RBAC:</strong> 4 roles (owner, admin, editor, viewer) × 9 resources × 3
              actions. DB-backed with 60s in-process cache.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">4. Infrastructure Security</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>Headers:</strong> Helmet.js with strict CSP (nonce-based), COEP, COOP, CORP,
              Referrer-Policy, Permissions-Policy.
            </li>
            <li>
              <strong>Rate limiting:</strong> Redis-backed sliding window. Per-IP global limits.
              Per-user API limits. Stricter auth endpoint limits.
            </li>
            <li>
              <strong>Webhook security:</strong> HMAC-SHA-256 signature verification. Idempotency
              via processed_webhook_events table.
            </li>
            <li>
              <strong>CORS:</strong> Strict allowlist (rakshex.in, app.rakshex.in). No wildcard or
              dynamic reflection.
            </li>
            <li>
              <strong>Dependencies:</strong> npm audit run in CI. Lockfile committed. No arbitrary
              code execution from untrusted packages.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">5. Compliance</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>SOC 2:</strong> 11-control evidence pack builder. Programmatic control
              evaluation over 90-day windows. Consumable by Vanta/Drata API.
            </li>
            <li>
              <strong>PCI DSS v4.0.1:</strong> Requirement mapping for OWASP findings. PDF report
              generation with compliance scores.
            </li>
            <li>
              <strong>GDPR:</strong> Data processing addendum available. EU/US data residency
              options. Right-to-erasure and data portability API.
            </li>
            <li>
              <strong>DPDP Act 2023 (India):</strong> Consent management. Data fiduciary
              obligations. Grievance redressal mechanism.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">6. Incident Response</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            Our incident response process follows NIST SP 800-61:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Detection: Automated alerts via PagerDuty + Slack + Discord</li>
            <li>
              Containment: Kill switch (sub-second trip), API key revocation, session termination
            </li>
            <li>Investigation: Full audit trail across auth, billing, scans, admin actions</li>
            <li>
              Notification: 72-hour supervisory authority notification. User notification without
              undue delay for high-risk breaches.
            </li>
            <li>
              Post-mortem: Blameless post-mortem with timeline, root cause, and corrective actions.
            </li>
          </ol>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-700">
          <p className="text-gray-500 text-sm">
            For questions about this whitepaper, contact{" "}
            <a href="mailto:security@rakshex.in" className="text-blue-400 hover:text-blue-300">
              security@rakshex.in
            </a>
            .
          </p>
          <div className="mt-4">
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
