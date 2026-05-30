import Link from "next/link";

export const metadata = {
  title: "Cookie Policy — RaksHex",
  description: "How RaksHex uses cookies and tracking technologies.",
};

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-blue-400">Cookie Policy</h1>
        <p className="text-gray-400 mb-8">
          Last updated: May 17, 2026. This policy explains what cookies we use, why we use them, and
          how you can control them.
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help
              the site remember your preferences, keep you signed in, and understand how you use the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. Cookies We Use</h2>
            <table className="w-full text-left border border-gray-700 rounded-lg overflow-hidden">
              <thead className="bg-gray-800">
                <tr>
                  <th className="p-3 text-white">Category</th>
                  <th className="p-3 text-white">Purpose</th>
                  <th className="p-3 text-white">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <tr>
                  <td className="p-3 font-medium">Essential</td>
                  <td className="p-3">
                    Authentication, session management, CSRF protection, security
                  </td>
                  <td className="p-3">Session / 7 days</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Preferences</td>
                  <td className="p-3">Theme, language, dashboard layout, cookie consent choice</td>
                  <td className="p-3">1 year</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Analytics</td>
                  <td className="p-3">Page views, feature usage (anonymized, no PII)</td>
                  <td className="p-3">90 days</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Marketing</td>
                  <td className="p-3">Ad campaign attribution (only if you opt in)</td>
                  <td className="p-3">90 days</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. Third-Party Cookies</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Stripe / Razorpay:</strong> Payment session cookies when processing
                subscriptions.
              </li>
              <li>
                <strong>Cloudflare:</strong> Security and performance cookies (strictly necessary).
              </li>
              <li>
                <strong>Sentry:</strong> Error tracking (no user-identifiable cookies).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Managing Cookies</h2>
            <p>
              You can manage or delete cookies through your browser settings. Note that disabling
              essential cookies may prevent you from signing in or using core features.
            </p>
            <p className="mt-2">
              When you first visit RaksHex, we show a cookie consent banner. You can change your
              preferences at any time by clicking the cookie icon in the footer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Updates</h2>
            <p>
              We may update this Cookie Policy when we add new features or change third-party
              integrations. Significant changes will be announced via email and the dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. Contact</h2>
            <p>
              Questions about cookies? Email{" "}
              <a href="mailto:privacy@rakshex.in" className="text-blue-400 hover:text-blue-300">
                privacy@rakshex.in
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 text-center text-gray-500 text-sm">
          Also see our{" "}
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-blue-400 hover:text-blue-300">
            Terms of Service
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
