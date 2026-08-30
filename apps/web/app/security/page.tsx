import Link from "next/link";

export const metadata = {
  title: "Security | RaksHex",
  description:
    "How RaksHex protects customer data in the Agent Firewall. Evidence, not badges.",
  alternates: { canonical: "/security" },
};

export default function SecurityWhitepaper() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-4xl mx-auto prose prose-invert">
        <p className="text-blue-400 text-sm font-medium mb-2">RaksHex Security</p>
        <h1 className="text-4xl font-bold mb-4">Security architecture</h1>
        <p className="text-gray-400 mb-8">
          Private beta · aligned with the Trust Center. Reviewers should start at{" "}
          <Link href="/trust" className="text-blue-400 hover:text-blue-300">
            /trust
          </Link>{" "}
          and email{" "}
          <a href="mailto:rakshex@gmail.com" className="text-blue-400 hover:text-blue-300">
            rakshex@gmail.com
          </a>
          .
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">What this page is</h2>
          <p className="text-gray-300 leading-relaxed">
            RaksHex is an Agent Firewall: runtime authorization for autonomous AI actions. This page
            describes controls that exist in the current product and in{" "}
            <code className="text-slate-400">docs/SECURITY.md</code>. It is not a certification, an
            audit report, or a data-residency catalog. Where a control is not yet in the private-beta
            cut, it is omitted rather than described as shipped.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">1. Threat model</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            We protect against the following categories when traffic is evaluated through the Agent
            Firewall and related governance paths:
          </p>
          <div className="space-y-4">
            {[
              {
                title: "Unauthorised agent actions",
                desc: "Semantic actions are authorised against delegated authority before they run. A child authority cannot exceed its parent. A DENY is enforced at credential mediation, not only as an advisory log line.",
              },
              {
                title: "Prompt injection and insecure output handling",
                desc: "Gateway and scanning paths inspect prompts and tool calls for injection and unsafe output patterns. Coverage depends on deployment configuration.",
              },
              {
                title: "Credential and secret exposure",
                desc: "Workspace credentials are encrypted before storage. List APIs return masked metadata and fingerprints. Discovery is designed to send masked metadata rather than secret values.",
              },
              {
                title: "Excessive agency",
                desc: "Kill switches, budgets, and tool allowlists can stop further calls when a policy trips. Response time depends on deployment topology.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-black/50 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-blue-400 mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">2. Encryption and authentication</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>Passwords:</strong> hashed with Argon2id. Legacy PBKDF2-SHA512 hashes are
              verified only for migration and upgraded on next successful login.
            </li>
            <li>
              <strong>Sessions:</strong> server-side sessions with HTTP-only cookies and CSRF
              protections on browser flows. OAuth uses PKCE.
            </li>
            <li>
              <strong>Multi-factor:</strong> TOTP-based 2FA is available for accounts that enable it.
            </li>
            <li>
              <strong>Workspace access:</strong> membership-scoped RBAC. API keys are hashed at rest.
              Cross-tenant access is denied by authorization helpers.
            </li>
            <li>
              <strong>Credentials:</strong> encrypted in a workspace-scoped vault. Secrets are not
              returned on list endpoints and do not leave the server on brokered calls.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">3. Runtime enforcement</h2>
          <ul className="space-y-3 text-gray-300 leading-relaxed">
            <li>
              <strong>Action Ledger:</strong> hash-chained, tamper-evident record of authorization
              decisions.
            </li>
            <li>
              <strong>Credential mediation:</strong> a DENY prevents the secret from being used. Shadow
              mode cannot launder a denied action into a brokered call.
            </li>
            <li>
              <strong>Kill switch:</strong> workspace, project, and agent kill switches on the gateway
              path. Fail-open versus fail-closed is configurable; emergency bypass is audited.
            </li>
            <li>
              <strong>Logging:</strong> structured logs redact passwords, tokens, API keys, and
              cookies. Raw prompts are not retained by default in hosted audit records.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">4. Compliance</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            RaksHex maps product controls to common frameworks (including OWASP, NIST AI RMF, ISO,
            SOC 2, GDPR, DPDP, and the EU AI Act) and can export that evidence.{" "}
            <strong className="text-white">
              We do not claim a certification or independent audit until that assessment is complete
              and published.
            </strong>{" "}
            Dashboard scores and PDFs, where present, are mapping artifacts for your own audit
            workflow — not an attestation that RaksHex is SOC 2, PCI DSS, OWASP, or ISO certified.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Data-processing terms, subprocessors, and transfer language live in the{" "}
            <Link href="/legal" className="text-blue-400 hover:text-blue-300">
              Legal Center
            </Link>
            . Residency, private relay, and self-hosted deployment are agreed on an enterprise Order
            Form when they apply; they are not marketed here as a standard product option.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">5. Incident contact</h2>
          <p className="text-gray-300 leading-relaxed">
            Report suspected vulnerabilities, privacy requests, legal notices, or security incidents to{" "}
            <a href="mailto:rakshex@gmail.com" className="text-blue-400 hover:text-blue-300">
              rakshex@gmail.com
            </a>
            . Do not send provider keys, passwords, or sensitive evidence by email.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-700">
          <p className="text-gray-500 text-sm">
            Verifiable commitments are on the{" "}
            <Link href="/trust" className="text-blue-400 hover:text-blue-300">
              Trust Center
            </Link>
            . This page will not list a badge, audit-in-progress status, or residency region until
            that evidence is published.
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
