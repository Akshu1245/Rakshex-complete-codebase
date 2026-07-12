import Link from "next/link";
import { FileText, Scale, ShieldCheck, Sparkles } from "lucide-react";

export const metadata = {
  title: "Legal Center | RakshEx",
  description:
    "RakshEx customer terms, privacy, data-processing, security, and AI transparency documents.",
  alternates: { canonical: "/legal" },
};

const documents = [
  {
    title: "Terms of Service",
    description: "Online service terms, billing, acceptable use, confidentiality, and liability.",
    href: "/terms",
    download: "/legal/rakshex-terms-of-service.docx",
    icon: Scale,
  },
  {
    title: "Privacy Policy",
    description: "Account, workspace, credential, telemetry, prompt, and data-rights practices.",
    href: "/privacy",
    download: "/legal/rakshex-privacy-policy.docx",
    icon: ShieldCheck,
  },
  {
    title: "Data Processing Addendum",
    description:
      "Controller-to-processor obligations, security measures, subprocessors, and transfer terms.",
    download: "/legal/rakshex-data-processing-addendum.docx",
    icon: FileText,
  },
  {
    title: "Enterprise SLA",
    description:
      "Order-form SLA with availability target, support response targets, exclusions, and credits.",
    download: "/legal/rakshex-enterprise-sla.docx",
    icon: FileText,
  },
  {
    title: "Acceptable Use Policy",
    description:
      "Boundaries for authorised scans, integrations, models, and AI-supported workflows.",
    download: "/legal/rakshex-acceptable-use-policy.docx",
    icon: FileText,
  },
  {
    title: "Refund and Cancellation Policy",
    description: "Self-serve cancellation, renewal, payment failure, and refund review process.",
    download: "/legal/rakshex-refund-cancellation-policy.docx",
    icon: FileText,
  },
  {
    title: "Subprocessor Register",
    description: "Active, conditional, and customer-directed service-provider categories.",
    download: "/legal/rakshex-subprocessor-register.docx",
    icon: FileText,
  },
  {
    title: "AI Transparency Statement",
    description: "Intended use, human oversight, data labels, limits, and provider boundaries.",
    download: "/legal/rakshex-ai-transparency-statement.docx",
    icon: Sparkles,
  },
];

export default function LegalCenter() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">
            Legal Center
          </p>
          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            Clear documents. Honest boundaries.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            These documents explain how RakshEx is sold, operated, secured, and governed. Enterprise
            paperwork becomes binding when incorporated into an executed Order Form.
          </p>
        </header>

        <section className="mt-14 grid gap-4 md:grid-cols-2">
          {documents.map(({ title, description, href, download, icon: Icon }) => (
            <article key={title} className="border border-slate-800 bg-slate-950/30 p-6">
              <Icon className="h-6 w-6 text-[#14B8A6]" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
                {href ? (
                  <Link className="text-[#14B8A6] hover:underline" href={href}>
                    Read online
                  </Link>
                ) : null}
                <a className="text-slate-200 hover:text-white hover:underline" href={download}>
                  Download DOCX
                </a>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-12 border border-slate-800 p-7">
          <h2 className="text-2xl font-semibold text-white">Security and privacy requests</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            For a signed DPA, completed security questionnaire, subprocessor notice, private relay,
            data-residency requirement, or incident contact, email privacy@rakshex.in or
            security@rakshex.in. Do not send provider keys, passwords, or sensitive incident
            evidence by email.
          </p>
        </section>
      </div>
    </main>
  );
}
