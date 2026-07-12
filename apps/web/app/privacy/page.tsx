import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | RakshEx",
  description: "How RakshEx handles account, workspace, and AI governance data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Effective 12 July 2026</p>

        <div className="mt-12 space-y-10 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">Roles</h2>
            <p className="mt-3">
              Rashi Technologies operates RakshEx from Bengaluru, India. We act as controller or
              data fiduciary for our website, account, billing, security, and sales data. For
              Customer Data in a workspace, the Customer controls the purpose and RakshEx acts as a
              processor or service provider under the applicable DPA.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Data we handle</h2>
            <p className="mt-3">
              This can include account and authentication data, workspace settings, masked discovery
              findings, subscription and seat records, audit events, usage and latency metadata,
              billing references, support messages, and encrypted credential material. We do not
              store card details.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Prompt and credential boundaries</h2>
            <p className="mt-3">
              Discovery is designed to send masked metadata and fingerprints rather than secret
              values. Raw prompts are not retained by default in hosted audit records. Gateway
              controls may process prompts transiently for policy evaluation, redaction, and
              routing. Customer configuration and connected providers affect processing.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Retention and sharing</h2>
            <p className="mt-3">
              We retain data only for service, security, billing, legal, and support purposes. The
              default schedule covers 180-day security logs, 13-month audit metadata, rolling
              backups, and Customer-configurable enterprise retention. We use limited service
              providers and disclose the current categories in the Subprocessor Register.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Your rights</h2>
            <p className="mt-3">
              Depending on applicable law, you may request access, correction, deletion, export,
              restriction, objection, withdrawal of consent, or grievance redressal. Email
              privacy@rakshex.in from your account address. Workspace-controlled requests may need
              to be handled by the Customer administrator.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Security and contact</h2>
            <p className="mt-3">
              We use access controls, encryption measures, audit logging, rate limits, and incident
              response processes designed for the Service. To report a vulnerability, email
              security@rakshex.in. For privacy questions or requests, email privacy@rakshex.in.
            </p>
          </section>
        </div>

        <div className="mt-12 border border-slate-800 p-6 text-sm text-slate-400">
          Read the detailed policy, Data Processing Addendum, retention schedule, and subprocessor
          register in the{" "}
          <Link className="font-semibold text-[#14B8A6] hover:underline" href="/legal">
            RakshEx Legal Center
          </Link>
          .
        </div>
      </article>
    </main>
  );
}
