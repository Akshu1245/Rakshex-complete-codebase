import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function TestimonialsSection() {
  return (
    <section
      className="mx-auto w-full max-w-[1280px] px-6 py-20 xl:px-8"
      aria-labelledby="proof-heading"
    >
      <div className="border border-neutral-700 bg-neutral-950/30 p-8 md:p-10">
        <ShieldCheck className="h-7 w-7 text-[#14B8A6]" aria-hidden="true" />
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">
          Adoption without theater
        </p>
        <h2
          id="proof-heading"
          className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-white"
        >
          Evaluate RakshEx with evidence you can inspect.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">
          We do not publish invented customer logos, quotations, or comparative scores. Pilot teams
          receive a scoped rollout plan, permission map, test cases, and an exportable audit trail
          for their own environment.
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 bg-[#14B8A6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0D9488]"
          >
            Run the product demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 border border-neutral-600 px-4 py-2.5 text-sm font-semibold text-white hover:border-[#14B8A6]"
          >
            Review trust commitments
          </Link>
        </div>
      </div>
    </section>
  );
}
