"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

const FAQS = [
  {
    question: "What is RaksHex?",
    answer:
      "RaksHex is an AI Action Control Plane. Its Agent Firewall evaluates semantic actions against delegated authority and policy before execution, mediates brokered credentials, and writes decisions to a hash-chained Action Ledger.",
  },
  {
    question: "Where does enforcement happen?",
    answer:
      "At the credential boundary. For brokered execution, a DENY prevents the requested credential from being released, so the blocked action does not merely become another alert in a dashboard.",
  },
  {
    question: "How is delegated authority different from a normal API key?",
    answer:
      "A broad API key proves what the credential can reach. RaksHex models what a specific agent action is allowed to do, and parent-to-child delegation can only preserve or narrow authority — never expand it.",
  },
  {
    question: "Who is the private beta for?",
    answer:
      "Engineering, platform, and security teams running AI agents or developer agents against consequential systems such as code, infrastructure, customer data, or paid AI providers.",
  },
] as const;

export function InvestorFaq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-6 xl:px-8" id="faq">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
        <div className="text-left">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">
            Private beta FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] text-white sm:text-4xl">
            The questions a security team should ask first.
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-400 sm:text-base">
            No certification theater and no magic claims. Start with the enforcement boundary,
            the authority model, and the evidence RaksHex leaves behind.
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#14B8A6] no-underline hover:text-[#5ED8CA]"
            href="/docs"
          >
            Read the Agent Firewall docs <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#090D14]/65">
          {FAQS.map((faq, index) => {
            const open = openFaq === index;
            const panelId = `investor-faq-panel-${index}`;
            return (
              <div key={faq.question} className="border-b border-white/[0.07] last:border-b-0">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-sm font-semibold text-white hover:text-[#14B8A6] sm:px-6 sm:text-base"
                    aria-expanded={open}
                    aria-controls={panelId}
                  >
                    <span>{faq.question}</span>
                    <ChevronRight
                      className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform ${
                        open ? "rotate-90 text-[#14B8A6]" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                {open && (
                  <div
                    id={panelId}
                    className="px-5 pb-5 text-sm leading-6 text-neutral-400 sm:px-6"
                  >
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
