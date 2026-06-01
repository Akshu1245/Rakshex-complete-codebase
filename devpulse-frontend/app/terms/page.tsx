export const metadata = {
  title: "Terms & Conditions — RaksHex",
  description: "Terms of service for using RaksHex.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="min-h-screen bg-transparent text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-2">Terms & Conditions</h1>
        <p className="text-gray-500 mb-12">Last updated: June 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">1. Acceptance</h2>
          <p className="leading-relaxed">
            By accessing RaksHex (
            <a href="https://rakshex.in" className="text-[#14B8A6] hover:underline">
              rakshex.in
            </a>
            ), you agree to these terms. If you do not agree, do not use the platform.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">2. Permitted Use</h2>
          <p className="leading-relaxed mb-3">
            RaksHex is provided for{" "}
            <strong className="text-white">lawful API security testing</strong> and LLM governance
            purposes only. You may use it to:
          </p>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>Scan APIs you own or have explicit written permission to test</li>
            <li>Monitor LLM costs and token usage in your own applications</li>
            <li>Generate compliance reports for your own systems</li>
          </ul>
          <p className="mt-3 leading-relaxed">
            You may <strong className="text-white">not</strong> use RaksHex to attack, scan, or test
            systems you do not own or have explicit permission to test.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">3. Intellectual Property</h2>
          <p className="leading-relaxed">
            All platform code, UI designs, documentation, and content are owned by{" "}
            <strong className="text-white">Rashi Technologies</strong>. Provisional patents filed:
            NHCE/DEV/2026/001–004. The name "RaksHex" and the RaksHex logo are registered
            trademarks.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">4. Subscriptions & Payments</h2>
          <p className="leading-relaxed">
            Paid subscriptions are billed via Razorpay. You may cancel anytime from the Billing
            page. No refunds are provided for partial months. We reserve the right to change pricing
            with 30 days notice.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">5. Disclaimer</h2>
          <p className="leading-relaxed">
            RaksHex is currently in beta. We make no guarantees of uptime or completeness of
            security coverage. Scan results are advisory only and do not constitute a security audit
            or penetration test. Use at your own risk during the beta period.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">6. Limitation of Liability</h2>
          <p className="leading-relaxed">
            To the maximum extent permitted by law, Rashi Technologies shall not be liable for any
            indirect, incidental, or consequential damages arising from the use of RaksHex.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">7. Governing Law</h2>
          <p className="leading-relaxed">
            These terms are governed by the laws of{" "}
            <strong className="text-white">Karnataka, India</strong>. Disputes shall be subject to
            the exclusive jurisdiction of courts in Bengaluru.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#14B8A6] mb-3">8. Contact</h2>
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
