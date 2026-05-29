import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-blue-400">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">
          Last updated: April 17, 2026. This document is written in plain English and should be read
          together with our{" "}
          <Link href="/terms" className="text-blue-400 hover:text-blue-300">
            Terms of Service
          </Link>
          .
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Who we are</h2>
            <p>
              Rakshex (&ldquo;Rakshex&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a
              security and operations platform for production AI agents. We act as the data
              controller for the personal data you provide when you create an account and as a data
              processor for the API traffic, telemetry, and findings you choose to route through the
              platform. Our contact address for privacy matters is{" "}
              <a href="mailto:privacy@rakshex.in" className="text-blue-400 hover:text-blue-300">
                privacy@rakshex.in
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. Data we collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Account data:</strong> name, email address, hashed password (PBKDF2-SHA512,
                100k iterations), and OAuth provider identifiers if you sign in with Google.
              </li>
              <li>
                <strong>Product usage:</strong> dashboard interactions, feature flags, browser
                user-agent, IP address (for rate limiting and audit logs), request timestamps.
              </li>
              <li>
                <strong>Customer content:</strong> API collections (Postman / OpenAPI), scan
                results, shadow API detections, LLM cost telemetry, kill-switch events, team
                membership, audit log entries.
              </li>
              <li>
                <strong>Billing data:</strong> plan tier, subscription status, and a Razorpay order
                ID. We do <em>not</em> store full card numbers — those are handled by Razorpay under
                PCI-DSS.
              </li>
              <li>
                <strong>VS Code extension telemetry:</strong> session start/stop, file-change
                counts, relative file paths (never file contents). Opt-out is available via the
                extension settings.
              </li>
              <li>
                <strong>Cookies:</strong> one strictly-necessary session cookie and one
                CSRF-protection cookie. No advertising, no cross-site tracking, no third-party
                analytics by default.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              3. Legal basis and purposes (GDPR art. 6)
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Contract (6(1)(b)):</strong> provide the service you signed up for —
                authentication, scanning, dashboards, team invites, billing.
              </li>
              <li>
                <strong>Legitimate interest (6(1)(f)):</strong> security monitoring, fraud
                prevention, rate limiting, aggregated analytics used to improve the product.
                Balancing-test documentation is available on request.
              </li>
              <li>
                <strong>Legal obligation (6(1)(c)):</strong> tax records, responding to lawful
                requests from supervisory authorities.
              </li>
              <li>
                <strong>Consent (6(1)(a)):</strong> optional email digests and any analytics beyond
                the default strictly-necessary set. You can withdraw consent at any time from the
                email preferences page or the unsubscribe link in every email.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              4. How we store and secure your data
            </h2>
            <p>
              Account data and customer content are stored in MySQL 8 hosted in the region you
              select at signup (EU or US). Data in transit uses TLS 1.3. Passwords are never stored
              in plaintext — only the PBKDF2 hash plus a per-user 32-byte salt. Secrets and API keys
              are stored server-side only and never logged. Access to production data is limited to
              named personnel, gated by hardware-backed SSO, and every access is written to an
              append-only audit log.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Sub-processors</h2>
            <p>We use a small set of sub-processors, each bound by a data processing addendum:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Razorpay</strong> — payments &amp; subscriptions.
              </li>
              <li>
                <strong>Your chosen SMTP provider</strong> (Resend / SendGrid / SES / Postmark) —
                transactional email.
              </li>
              <li>
                <strong>Sentry</strong> — error monitoring (if you enable it).
              </li>
              <li>
                <strong>Your cloud provider</strong> (AWS / Fly.io / Railway / self-host) — compute
                and storage.
              </li>
            </ul>
            <p className="mt-2">
              A current list with addresses is available at{" "}
              <a href="mailto:dpo@rakshex.in" className="text-blue-400 hover:text-blue-300">
                dpo@rakshex.in
              </a>
              . We will notify customers of material changes 30 days in advance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. International transfers</h2>
            <p>
              If you select a US-hosted deployment from the EU or UK, transfers rely on the EU
              Commission&rsquo;s Standard Contractual Clauses (2021/914) with supplementary measures
              (encryption at rest and in transit, audit logging, limited administrative access). You
              can request a copy of the executed SCCs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Data retention</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Account data: for as long as your account is active.</li>
              <li>
                Scan results &amp; shadow API detections: 12 months rolling by default (configurable
                per workspace).
              </li>
              <li>Audit logs: 24 months.</li>
              <li>Invoices &amp; tax records: 7 years (legal obligation).</li>
              <li>Backups: 30 daily snapshots, 12 monthly snapshots, then purged.</li>
            </ul>
            <p className="mt-2">
              On account deletion we purge active data within 30 days and backups within an
              additional 90 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">
              8. Your rights (GDPR / UK GDPR / CCPA)
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Right of access to the personal data we hold about you</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure (&ldquo;right to be forgotten&rdquo;)</li>
              <li>Right to restrict or object to processing</li>
              <li>Right to data portability (machine-readable export)</li>
              <li>Right to lodge a complaint with your supervisory authority</li>
              <li>
                CCPA: right to know, delete, correct, and opt out of &ldquo;sale&rdquo; (we do not
                sell personal information)
              </li>
            </ul>
            <p className="mt-2">
              Email{" "}
              <a href="mailto:privacy@rakshex.in" className="text-blue-400 hover:text-blue-300">
                privacy@rakshex.in
              </a>{" "}
              from the email address on your account to exercise any of these. We respond within 30
              days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Security incident response</h2>
            <p>
              In the event of a personal-data breach likely to cause risk to you, we notify the
              relevant supervisory authority within 72 hours and, where the risk is high, notify
              affected users without undue delay. Our incident response playbook is audited
              annually.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. Children</h2>
            <p>
              Rakshex is not directed at children under 16 and we do not knowingly collect personal
              data from children. If you believe a child has provided us personal data, contact us
              and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">11. Changes to this policy</h2>
            <p>
              We post changes here and, for material changes, send an email notice 30 days before
              they take effect. Continued use of Rakshex after the effective date constitutes
              acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">12. Contact</h2>
            <p>
              Privacy or DPO questions:{" "}
              <a href="mailto:privacy@rakshex.in" className="text-blue-400 hover:text-blue-300">
                privacy@rakshex.in
              </a>
              . If you are in the EU/EEA you may also contact our representative listed in the data
              processing addendum.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 flex flex-col gap-2 sm:flex-row sm:justify-between text-sm text-gray-400">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Home
          </Link>
          <span>
            This document is a template provided with the platform and should be reviewed by your
            counsel before production use.
          </span>
        </div>
      </div>
    </div>
  );
}
