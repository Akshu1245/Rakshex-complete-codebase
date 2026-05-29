import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-blue-400">Terms of Service</h1>
        <p className="text-gray-400 mb-8">
          Last updated: April 17, 2026. These Terms form a binding agreement between you (or the
          entity you represent) and Rakshex. Please also read our{" "}
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Acceptance</h2>
            <p>
              By creating an account, signing in, or using Rakshex you agree to these Terms. If you
              do not agree, do not use the service. If you use Rakshex on behalf of an organization,
              you represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. The service</h2>
            <p>
              Rakshex provides API security scanning, LLM cost monitoring, shadow API detection,
              compliance reporting, a kill switch, and related dashboards. Features vary by plan. We
              improve the service over time; we may add, remove, or modify features, but we will
              give reasonable notice before removing or materially degrading a paid feature.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. Account &amp; security</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You are responsible for all activity under your credentials and API keys.</li>
              <li>You must use a password of at least 8 characters and keep it confidential.</li>
              <li>
                You must notify us promptly if you suspect unauthorized access at{" "}
                <a href="mailto:security@rakshex.in" className="text-blue-400 hover:text-blue-300">
                  security@rakshex.in
                </a>
                .
              </li>
              <li>
                Accounts can be locked after repeated failed logins as an automated safeguard.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Scan systems you do not own or are not authorized to scan;</li>
              <li>Use Rakshex to develop or improve a directly-competing product;</li>
              <li>
                Attempt to reverse-engineer, break, or probe the service outside of an authorized
                security program;
              </li>
              <li>
                Upload malware, personal data of individuals who have not consented, or content that
                infringes third-party rights;
              </li>
              <li>Circumvent rate limits, plan quotas, or kill-switch protections.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Customer data &amp; ownership</h2>
            <p>
              You retain all rights in the content you submit to Rakshex (collections, code
              references, scan results). You grant us a limited, worldwide, royalty-free license to
              host, process, and display that content solely to provide the service to you and your
              team. We will not access your content except as needed to operate, secure, or support
              the service, or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. Plans, billing &amp; refunds</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Subscriptions are billed in advance via Razorpay. Fees are exclusive of taxes unless
                stated otherwise.
              </li>
              <li>
                You can cancel at any time from the Billing page; your plan stays active until the
                end of the paid period and does not auto-renew after cancellation.
              </li>
              <li>
                Refunds are provided within 14 days of the first charge on a new subscription if you
                have not used a significant portion of the plan&rsquo;s quotas. Write to{" "}
                <a href="mailto:billing@rakshex.in" className="text-blue-400 hover:text-blue-300">
                  billing@rakshex.in
                </a>
                .
              </li>
              <li>
                Fee changes take effect on the next renewal cycle. We give at least 30 days&rsquo;
                notice before increases.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Service level</h2>
            <p>
              For paid plans we target 99.9% monthly uptime. Detailed SLAs, response times, and
              credits for Pro and Enterprise plans are documented in your order form or on request.
              Scheduled maintenance is announced at least 48 hours in advance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">8. Warranty disclaimer</h2>
            <p>
              Except as expressly provided, Rakshex is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo;. We disclaim all implied warranties including merchantability,
              fitness for a particular purpose, and non-infringement. Security scanning surfaces
              findings but does not guarantee the absence of vulnerabilities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, neither party will be liable for indirect,
              special, incidental, consequential, or punitive damages, or lost profits, revenue, or
              data. Our total aggregate liability in any 12-month period will not exceed the amount
              you paid us in that period. These limits do not apply to gross negligence, willful
              misconduct, or indemnification obligations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. Indemnification</h2>
            <p>
              You will defend and indemnify us against third-party claims arising from your
              violation of these Terms, your customer content, or your unauthorized scanning of
              systems. We will defend and indemnify you against third-party claims that the service,
              when used as permitted, infringes their intellectual property, subject to the
              liability cap above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">11. Termination</h2>
            <p>
              Either party may terminate for convenience on 30 days&rsquo; written notice. Either
              party may terminate for material breach uncured after 14 days. On termination we will,
              on request, return or delete your content per the Privacy Policy retention rules.
              Sections that by their nature should survive termination do.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">12. Governing law &amp; disputes</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction named in your order form
              (default: Delaware, USA, excluding conflicts-of-law rules). Disputes are resolved by
              binding arbitration in that jurisdiction unless local consumer law requires otherwise.
              You may bring small-claims matters in your local court.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">13. Changes</h2>
            <p>
              We may update these Terms. Material changes take effect 30 days after we post them or
              email you. Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">14. Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:legal@rakshex.in" className="text-blue-400 hover:text-blue-300">
                legal@rakshex.in
              </a>
              .
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
