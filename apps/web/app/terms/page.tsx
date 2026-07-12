import Link from "next/link";

export const metadata = {
  title: "Terms of Service | RakshEx",
  description: "Terms governing access to the RakshEx AI governance platform.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Effective 12 July 2026</p>

        <div className="mt-12 space-y-10 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">Acceptance and authority</h2>
            <p className="mt-3">
              These terms govern RakshEx websites, hosted services, software, APIs, extensions,
              private relays, and support. By using the Service, you agree to them. If you use it
              for an organisation, you represent that you can bind that organisation.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Authorised use</h2>
            <p className="mt-3">
              Use RakshEx only for systems, repositories, accounts, credentials, and data you own or
              are authorised to access. You must comply with provider terms and our Acceptable Use
              Policy. Do not use the Service to scan or disrupt systems without permission.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Customer data and AI providers</h2>
            <p className="mt-3">
              You retain Customer Data. RakshEx processes it only to provide, secure, support, and
              improve the Service as described in the Privacy Policy and, where applicable, the Data
              Processing Addendum. Provider subscriptions and accounts remain subject to the
              provider&apos;s own terms, availability, permissions, and charges.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Automated outputs</h2>
            <p className="mt-3">
              Findings, policy decisions, cost estimates, compliance mappings, and remediation
              suggestions are decision-support material. They are not a security certification,
              penetration-test attestation, legal advice, or a substitute for qualified human
              review.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Fees and cancellation</h2>
            <p className="mt-3">
              Paid plans renew until cancelled. Pricing, usage limits, taxes, and billing intervals
              are shown at checkout or in an Order Form. The Refund and Cancellation Policy governs
              self-serve purchases; an executed Order Form governs enterprise commitments.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">
              Security, confidentiality, and liability
            </h2>
            <p className="mt-3">
              Each party must protect the other&apos;s confidential information with reasonable
              care. RakshEx maintains reasonable security measures, but no service is risk-free. The
              full terms contain the applicable warranty, indemnity, and liability provisions.
              Mandatory consumer rights are not excluded.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Governing law and contact</h2>
            <p className="mt-3">
              These terms are governed by the laws of India and disputes are subject to the courts
              at Bengaluru, Karnataka, subject to mandatory consumer rights. Contact
              legal@rakshex.in for notices or support@rakshex.in for service help.
            </p>
          </section>
        </div>

        <div className="mt-12 border border-slate-800 p-6 text-sm text-slate-400">
          The complete contract pack, including the Data Processing Addendum, enterprise SLA,
          Acceptable Use Policy, and refund policy, is available in the{" "}
          <Link className="font-semibold text-[#14B8A6] hover:underline" href="/legal">
            RakshEx Legal Center
          </Link>
          .
        </div>
      </article>
    </main>
  );
}
