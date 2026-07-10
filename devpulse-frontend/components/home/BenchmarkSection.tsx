import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const capabilities = [
  {
    title: "Discover without exfiltration",
    detail:
      "Local and CI scanners send masked findings and fingerprints, never plaintext keys or raw repository content.",
  },
  {
    title: "Govern API and subscription access",
    detail:
      "Track credentials separately from provider accounts, cloud resources, plans, seats, owners, and renewal evidence.",
  },
  {
    title: "Enforce at runtime",
    detail:
      "Evaluate provider and model rules, budgets, tool policies, PII redaction, injection signals, and kill switches before execution.",
  },
];

export function BenchmarkSection() {
  return (
    <section
      className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-6 py-24 xl:px-8"
      id="why-rakshex"
    >
      <div className="max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">
          One system of record
        </p>
        <h2 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[40px]">
          Security, FinOps, and developer access should agree on what AI is running.
        </h2>
        <p className="mt-4 text-base leading-7 text-neutral-400">
          Point tools solve isolated pieces. RakshEx connects discovery, ownership, policy, and
          evidence so the same answer holds up in an engineering review, a finance review, and an
          audit.
        </p>
      </div>
      <div className="mt-12 grid w-full gap-4 md:grid-cols-3">
        {capabilities.map((capability) => (
          <article
            key={capability.title}
            className="border border-neutral-700 bg-neutral-950/30 p-6"
          >
            <CheckCircle2 className="h-5 w-5 text-[#14B8A6]" aria-hidden="true" />
            <h3 className="mt-5 text-lg font-semibold text-white">{capability.title}</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-400">{capability.detail}</p>
          </article>
        ))}
      </div>
      <Link
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#14B8A6] hover:text-[#0D9488]"
        href="/control-plane"
      >
        Explore the AI control plane <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
