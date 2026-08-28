import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import { ArchitectureCompareSlider } from "@/components/home/ArchitectureCompareSlider";
import { WhyMoveToRaksHex } from "@/components/home/WhyMoveToRaksHex";
import { BuiltInCapabilities } from "@/components/home/BuiltInCapabilities";
import { EcosystemIntegrations } from "@/components/home/EcosystemIntegrations";
import { BenchmarkSection } from "@/components/home/BenchmarkSection";
import { ChangelogSection } from "@/components/home/ChangelogSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { InvestorFaq } from "@/components/home/InvestorFaq";
import { Footer } from "@/components/layout/Footer";

const PROOF_FLOW = [
  ["01", "Authorize", "Evaluate the semantic action before execution."],
  ["02", "Attenuate", "Keep child authority equal to or narrower than its parent."],
  ["03", "Broker", "Release credentials only after an enforceable ALLOW."],
  ["04", "Record", "Write the decision to a tamper-evident Action Ledger."],
] as const;

export default function RootHomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-transparent pb-0 pt-[94px] font-sans text-white selection:bg-[#14B8A6] selection:text-black">
      <HeroSection />

      <section
        className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-6 xl:px-8"
        aria-label="RaksHex beta proof points"
      >
        <div className="grid overflow-hidden rounded-xl border border-white/[0.08] bg-[#090D14]/70 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF_FLOW.map(([index, title, detail]) => (
            <div
              key={title}
              className="border-b border-white/[0.07] p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#14B8A6]">
                {index}
              </span>
              <h2 className="mt-2 text-base font-semibold text-white">{title}</h2>
              <p className="mt-1.5 text-xs leading-5 text-neutral-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <ArchitectureCompareSlider />
      <WhyMoveToRaksHex />
      <BuiltInCapabilities />
      <EcosystemIntegrations />
      <BenchmarkSection />
      <TestimonialsSection />
      <ChangelogSection />
      <InvestorFaq />

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-24 sm:px-6 xl:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-[#14B8A6]/25 bg-[#0B1414] px-6 py-10 sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#14B8A6]/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-2 text-[#14B8A6]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">
                Scoped private beta
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
              Put one consequential AI action behind RaksHex.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
              Start with one agent, one provider, and one action that matters. Prove ALLOW, DENY,
              credential mediation, and the resulting audit evidence before expanding the rollout.
            </p>
          </div>
          <div className="relative mt-7 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
            <Link
              href="/waitlist"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
            >
              Request beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/15 px-5 py-3 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/50"
            >
              Run the public demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
