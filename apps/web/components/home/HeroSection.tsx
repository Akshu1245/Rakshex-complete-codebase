"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { TerminalDemo } from "./TerminalDemo";
import { LogoMarquee } from "../ui/LogoMarquee";

const PROOF_POINTS = [
  "Pre-execution authorization",
  "Fail-closed credential broker",
  "Hash-chained Action Ledger",
  "Node + Python clients",
] as const;

export function HeroSection() {
  const [copied, setCopied] = useState(false);
  const [activeLogoName, setActiveLogoName] = useState("OpenAI");

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText("financial.refund({ amount: 400, orderId })");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="hero-section relative w-full overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_72%_18%,rgba(20,184,166,0.10),transparent_38%)]" />

      <div className="hero-grid relative z-10">
        <div className="hero-left text-left">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8FE3D8] sm:text-xs">
              Private beta · AI Action Control Plane
            </p>
          </div>

          <h1 className="hero-headline mb-6 flex flex-col text-left font-sans font-bold tracking-[-0.045em]">
            <span className="text-white">AI agents don&apos;t just generate.</span>
            <span className="text-[#14B8A6]">They act.</span>
            <span className="text-white">Control what happens next.</span>
          </h1>

          <p className="hero-subtext mb-8 max-w-[610px] font-sans text-base font-normal leading-7 text-[#A7ADB7] sm:text-lg sm:leading-8">
            RaksHex evaluates consequential AI actions before execution, checks delegated authority
            and policy, releases brokered credentials only after an ALLOW, and records every
            decision in a tamper-evident Action Ledger.
          </p>

          <div className="hero-buttons mb-7 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/waitlist"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
            >
              Request beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/50 hover:bg-[#14B8A6]/[0.06]"
            >
              <PlayCircle className="h-4 w-4 text-[#14B8A6]" aria-hidden="true" />
              See an action get blocked
            </Link>
          </div>

          <p className="mb-8 text-xs leading-5 text-neutral-500">
            Scoped evaluation for engineering and security teams. No self-serve production claims.
          </p>

          <div className="mb-6 flex max-w-full flex-wrap items-center gap-3">
            <div className="hero-cli-pill flex max-w-full items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 sm:px-4">
              <span className="cli-text min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-[#B7EAE4] sm:text-xs">
                financial.refund({"{ amount: 400, orderId }"})
              </span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-white/[0.1]"
                aria-live="polite"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="grid max-w-[650px] grid-cols-1 gap-x-5 gap-y-2 border-y border-white/[0.07] py-4 sm:grid-cols-2">
            {PROOF_POINTS.map((point) => (
              <span key={point} className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#14B8A6]" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>

          <div className="hero-marquee-label-container mt-8">
            <span className="marquee-label">Works with</span>
            <span className="marquee-active-name">{activeLogoName}</span>
          </div>
        </div>

        <div className="hero-right flex items-center justify-center" aria-label="RaksHex action denial demo">
          <TerminalDemo />
        </div>
      </div>

      <div className="marquee-full-width">
        <LogoMarquee hideHeader={true} onActiveNameChange={setActiveLogoName} />
      </div>
    </section>
  );
}
