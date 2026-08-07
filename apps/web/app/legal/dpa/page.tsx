import Link from "next/link";

export const metadata = {
  title: "Data Processing Addendum | RaksHex",
  description:
    "Controller-to-processor obligations, security measures, subprocessors, and transfer terms.",
  alternates: { canonical: "/legal/dpa" },
};

export default function DataProcessingAddendumPage() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Data Processing Addendum</h1>
        <p className="mt-3 text-sm text-slate-500">Effective 12 July 2026</p>
        <p className="mt-4 text-sm">
          <Link href="/legal" className="text-[#14B8A6] hover:underline">
            Legal center
          </Link>
          {" · "}
          <a
            href="/legal/rakshex-data-processing-addendum.docx"
            className="text-[#14B8A6] hover:underline"
          >
            Download DOCX
          </a>
        </p>

        <div className="mt-12 space-y-10 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">Roles and scope</h2>
            <p className="mt-3">
              Customer is the controller (or data fiduciary) and RaksHex is the processor. We
              process Customer Personal Data only on documented instructions — the Agreement, this
              DPA, product configuration, and authorised support requests — unless law requires
              otherwise.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Processor commitments</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Process data only to provide, secure, support, and improve the Service</li>
              <li>Bind personnel to confidentiality; maintain Annex 2 security measures</li>
              <li>Assist with data-subject requests, DPIAs, and breach response</li>
              <li>Notify without undue delay after a confirmed Personal Data Breach</li>
              <li>
                Not sell Customer Personal Data or use it for advertising or general-model training
              </li>
              <li>
                Return or delete Customer Personal Data on termination, subject to legal retention
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Subprocessors and transfers</h2>
            <p className="mt-3">
              Customer authorises the categories listed in the{" "}
              <a
                href="/legal/rakshex-subprocessor-register.docx"
                className="text-[#14B8A6] hover:underline"
              >
                Subprocessor Register
              </a>
              . Material additions get at least 30 days&apos; notice. International transfers rely
              on SCCs or UK addendum where required, completed via Order Form.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Binding effect</h2>
            <p className="mt-3">
              This online summary is for convenience. The executable DPA is the DOCX (or Order Form
              exhibit) reviewed by counsel. Placeholder entity / GST / grievance fields must be
              completed before commercial signature — see{" "}
              <code className="text-slate-400">docs/operations/LEGAL_LAUNCH_SIGNOFF.md</code>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
