import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, Network, ScrollText, ShieldCheck } from "lucide-react";
import { BuiltInCapabilities } from "@/components/home/BuiltInCapabilities";
import { ArchitectureCompareSlider } from "@/components/home/ArchitectureCompareSlider";
import { WhyMoveToRaksHex } from "@/components/home/WhyMoveToRaksHex";
import { EcosystemIntegrations } from "@/components/home/EcosystemIntegrations";
import { BenchmarkSection } from "@/components/home/BenchmarkSection";
import { Footer } from "@/components/layout/Footer";

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "Action Control",
    detail: "Evaluate a semantic action against policy and delegated authority before execution.",
  },
  {
    icon: Network,
    title: "Delegated Authority",
    detail: "Parent-to-child authority can preserve or narrow scope, but cannot silently expand it.",
  },
  {
    icon: KeyRound,
    title: "Credential Broker",
    detail: "For brokered execution, a DENY prevents the requested credential from being released.",
  },
  {
    icon: ScrollText,
    title: "Action Ledger",
    detail: "Record decision context in a hash-chained ledger designed to make tampering evident.",
  },
] as const;

export default function OverviewPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-transparent pb-0 pt-[94px] text-white">
      <main>
        <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 pt-14 sm:px-6 sm:pt-20 xl:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">
                Product · AI Action Control Plane
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl lg:text-7xl">
                Put a control point between <span className="text-[#14B8A6]">agent intent</span> and real-world execution.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">
                RaksHex turns an agent request into a governed action: identify the actor, resolve
                delegated authority, evaluate policy, mediate the credential, and preserve the
                resulting decision evidence.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/demo"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
                >
                  Try the Agent Firewall demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/docs/agent-firewall"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/45"
                >
                  Read the technical model
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#090D14]/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Governed action receipt
              </p>
              <div className="mt-4 space-y-3 font-mono text-[11px]">
                {[
                  ["actor", "support-agent-prod"],
                  ["action", "financial.refund"],
                  ["requested", "$400"],
                  ["authority", "refund ≤ $50"],
                  ["decision", "DENY"],
                  ["credential", "NOT RELEASED"],
                  ["ledger", "0x8f7a21c4"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                    <span className="text-neutral-600">{label}</span>
                    <span
                      className={`break-words ${
                        value === "DENY" || value === "NOT RELEASED"
                          ? "font-semibold text-red-400"
                          : label === "ledger"
                            ? "text-[#14B8A6]"
                            : "text-neutral-300"
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRIMITIVES.map((primitive) => {
              const Icon = primitive.icon;
              return (
                <div key={primitive.title} className="rounded-xl border border-white/[0.08] bg-[#090D14]/55 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#14B8A6]/20 bg-[#14B8A6]/[0.06] text-[#14B8A6]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-white">{primitive.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{primitive.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-5 pb-10 sm:px-6 xl:px-8">
          <div className="rounded-xl border border-[#14B8A6]/20 bg-[#0B1414] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#14B8A6]" aria-hidden="true" />
              <p className="text-sm leading-6 text-neutral-300">
                Private-beta rule: begin with one agent and one consequential action. Expand only
                after the authority map and decision evidence are understood.
              </p>
            </div>
            <Link
              href="/waitlist"
              className="mt-4 inline-flex shrink-0 text-sm font-semibold text-[#14B8A6] no-underline hover:text-[#5ED8CA] sm:mt-0"
            >
              Request a scoped evaluation →
            </Link>
          </div>
        </section>

        <BuiltInCapabilities />
        <ArchitectureCompareSlider />
        <WhyMoveToRaksHex />
        <EcosystemIntegrations />
        <BenchmarkSection />
      </main>
      <Footer />
    </div>
  );
}
