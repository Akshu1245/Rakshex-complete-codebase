export const metadata = {
  title: "Privacy Policy — RaksHex",
  description: "How RaksHex collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0A0E1A] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-12">Last updated: June 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">1. Who We Are</h2>
          <p className="leading-relaxed">
            RaksHex is an AI Runtime Governance platform built by{" "}
            <strong className="text-white">Rashi Technologies</strong>, Bengaluru, India. Contact:{" "}
            <a href="mailto:akshay@rakshex.in" className="text-[#14B8A6] hover:underline">
              akshay@rakshex.in
            </a>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">2. What We Collect</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>
              <strong className="text-white">Account data:</strong> Email, name, and password
              (hashed) when you sign up.
            </li>
            <li>
              <strong className="text-white">Usage data:</strong> API scans, collections imported,
              and feature usage for billing and product improvement.
            </li>
            <li>
              <strong className="text-white">Payment data:</strong> Handled entirely by Razorpay. We
              do not store card numbers.
            </li>
          </ul>
          <p className="mt-3 leading-relaxed">
            We <strong className="text-white">never</strong> sell your data to third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>Provide and maintain the RaksHex service</li>
            <li>Send security alerts and product updates</li>
            <li>Process payments and manage subscriptions</li>
            <li>Improve our scanning engines and detection accuracy</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">4. Cookies & Tracking</h2>
          <p className="leading-relaxed">
            We use strictly necessary first-party cookies for authentication and session management.
            No third-party advertising or tracking cookies are used.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">
            5. Data Retention & Deletion
          </h2>
          <p className="leading-relaxed">
            You may request full deletion of your account and data at any time by emailing{" "}
            <a href="mailto:akshay@rakshex.in" className="text-[#14B8A6] hover:underline">
              akshay@rakshex.in
            </a>
            . We will process deletion requests within{" "}
            <strong className="text-white">7 business days</strong>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">6. Security</h2>
          <p className="leading-relaxed">
            All data is encrypted in transit (TLS 1.3) and at rest. We follow OWASP guidelines and
            conduct regular security audits.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">7. Contact</h2>
          <p className="leading-relaxed">
            Rashi Technologies
            <br />
            Bengaluru, Karnataka, India
            <br />
            Email:{" "}
            <a href="mailto:akshay@rakshex.in" className="text-[#14B8A6] hover:underline">
              akshay@rakshex.in
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
