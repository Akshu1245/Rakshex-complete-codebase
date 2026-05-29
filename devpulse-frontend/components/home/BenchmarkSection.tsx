"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BenchmarkSection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="benchmark"
      ref={sectionRef}
      className="relative w-full max-w-[680px] xl:max-w-[1280px] mx-auto flex flex-col items-center justify-center py-24 px-6 select-none bg-transparent"
    >
      <div className="w-full flex flex-col items-center gap-10">
        {/* Section Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[32px] leading-[1.2] font-normal font-manrope text-white">
            If You Use AI Agents, Secure Them with RakshEx
          </h2>
          <p className="text-neutral-400 font-manrope text-[17px] leading-8">
            Tested across 50 real-world agent environments. Lower latency, higher detection rates,
            fewer errors.
          </p>
        </div>

        {/* Benchmark Grid */}
        <div className="w-full rounded-lg max-w-[1256px] mx-auto border border-neutral-800 overflow-hidden bg-[#141414]">
          <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-neutral-800">
            {/* Metric 1 */}
            <div className="flex flex-col gap-12 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-[#141414]">
              <div className="flex flex-col">
                <p className="text-[48px] leading-[1.2] font-inter font-medium italic text-[#00d4aa] select-none">
                  2.3x More
                </p>
                <p className="text-neutral-500 font-inter text-sm font-semibold tracking-wider uppercase mt-1">
                  Vulnerabilities Detected
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* Row 1 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-sm leading-5 shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00d4aa] rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-300 font-manrope text-sm leading-5 select-none font-semibold">
                    94%
                  </p>
                </div>
                {/* Row 2 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "41%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    41%
                  </p>
                </div>
                {/* Row 3 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "23%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    23%
                  </p>
                </div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col gap-12 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-[#141414]">
              <div className="flex flex-col">
                <p className="text-[48px] leading-[1.2] font-inter font-medium italic text-[#00d4aa] select-none">
                  9x Fewer
                </p>
                <p className="text-neutral-500 font-inter text-sm font-semibold tracking-wider uppercase mt-1">
                  False Positives
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* Row 1 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-sm leading-5 shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00d4aa] rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "10%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-300 font-manrope text-sm leading-5 select-none font-semibold">
                    2.1%
                  </p>
                </div>
                {/* Row 2 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "58%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    18.4%
                  </p>
                </div>
                {/* Row 3 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    31.2%
                  </p>
                </div>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col gap-12 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-[#141414]">
              <div className="flex flex-col">
                <p className="text-[48px] leading-[1.2] font-inter font-medium italic text-[#00d4aa] select-none">
                  15x Faster
                </p>
                <p className="text-neutral-500 font-inter text-sm font-semibold tracking-wider uppercase mt-1">
                  Time to First Finding
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* Row 1 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-sm leading-5 shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00d4aa] rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "8%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-300 font-manrope text-sm leading-5 select-none font-semibold">
                    3s
                  </p>
                </div>
                {/* Row 2 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    47s
                  </p>
                </div>
                {/* Row 3 */}
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-manrope text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-1 flex-1 shrink-0 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all duration-[1200ms] ease-out"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <p className="w-12 text-right text-neutral-400 font-manrope text-sm leading-5 select-none">
                    N/A
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center flex flex-col items-center gap-3">
          <p className="text-xs text-neutral-500 font-mono italic">
            * Internal benchmarks. 50 real-world API collections. Independent audit Q3 2026.
          </p>
          <Link
            className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors font-manrope"
            href="/blog/benchmark-methodology"
          >
            View full benchmark report
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
