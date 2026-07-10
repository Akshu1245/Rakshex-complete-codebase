import Link from "next/link";
import { FileCheck2, KeyRound, ShieldCheck, Trash2 } from "lucide-react";

export const metadata = {
  title: "Trust Center | RakshEx",
  description:
    "RakshEx security architecture, data-handling commitments, and responsible disclosure process.",
  alternates: { canonical: "/trust" },
};

const commitments = [
  {
    icon: KeyRound,
    title: "Credential boundaries",
    body: "Workspace credentials are encrypted before storage. List APIs return masked metadata and fingerprints, not encrypted values or plaintext keys. Revocation actions are audited.",
  },
  {
    icon: ShieldCheck,
    title: "Prompt-minimizing design",
    body: "Discovery ingests masked findings. Gateway policy evaluation can redact PII and records audit metadata without retaining raw prompts by default.",
  },
  {
    icon: Trash2,
    title: "Customer control",
    body: "Workspace data is scoped by membership and can be exported or deleted through the product and support process. Retention and private-data-plane requirements are agreed for enterprise deployments.",
  },
  {
    icon: FileCheck2,
    title: "Evidence, not badges",
    body: "RakshEx maps product controls to common frameworks and produces evidence. We do not claim a certification or independent audit until that assessment is complete and published.",
  },
];

export default function TrustCenter() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">
            Trust Center
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Security claims you can verify.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            RakshEx is built to give teams control over AI access without turning customer prompts
            and provider keys into another source of risk.
          </p>
        </header>

        <section className="mt-14 grid gap-4 md:grid-cols-2">
          {commitments.map(({ icon: Icon, title, body }) => (
            <article key={title} className="border border-slate-800 bg-slate-950/30 p-6">
              <Icon className="h-6 w-6 text-[#14B8A6]" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 border border-slate-800 bg-slate-950/30 p-7">
          <h2 className="text-2xl font-semibold text-white">What a security review can inspect</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-400">
            <li>Workspace authorization checks and tenant-isolation test coverage.</li>
            <li>
              Credential encryption, fingerprinting, lifecycle state, and sensitive-action audit
              trails.
            </li>
            <li>
              Prompt-retention defaults, redaction behavior, provider capability limits, and data
              provenance labels.
            </li>
            <li>
              Deployment architecture for SaaS, private relay, and self-hosted enterprise
              environments.
            </li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href="/security"
              className="border border-[#14B8A6] px-4 py-2.5 text-sm font-semibold text-[#14B8A6] hover:bg-[#14B8A6]/10"
            >
              Security details
            </Link>
            <Link
              href="/status"
              className="border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:border-slate-500"
            >
              Service status
            </Link>
            <a
              href="mailto:security@rakshex.in"
              className="border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:border-slate-500"
            >
              Report a vulnerability
            </a>
          </div>
        </section>

        <p className="mt-8 text-sm leading-6 text-slate-500">
          For a DPA, security questionnaire, architecture review, or private deployment
          requirements, contact the RakshEx team before connecting production accounts.
        </p>
      </div>
    </main>
  );
}
