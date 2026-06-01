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
      ref={sectionRef}
      className="relative w-full max-w-[680px] xl:max-w-[1280px] mx-auto flex flex-col items-center justify-center py-24 px-6 bg-transparent"
      id="benchmark"
    >
      <div className="w-full flex flex-col items-center gap-10">
        {/* Section Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[32px] sm:text-[40px] leading-tight font-bold font-sans text-white text-center tracking-[-0.02em]">
            If You Use AI Agents, Secure Them with RakshEx
          </h2>
        </div>

        {/* 3-Metric Horizontal Bar Chart Grid */}
        <div className="w-full rounded-lg max-w-[1256px] mx-auto border border-neutral-700 overflow-hidden shadow-2xl">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-neutral-700">
            {/* Metric 1 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-transparent">
              <div className="flex flex-col">
                <p className="text-[48px] leading-tight font-sans font-extrabold italic text-[#14B8A6] select-none">
                  2.3x More
                </p>
                <p className="text-neutral-400 font-sans text-lg font-semibold select-none mt-1">
                  More Vulnerabilities Detected
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-sans text-sm leading-5 shrink-0 select-none font-medium">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#14B8A6] rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-300 font-mono text-sm leading-5 text-right select-none font-semibold">
                    94%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "41%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    41%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "23%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    23%
                  </p>
                </div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-transparent">
              <div className="flex flex-col">
                <p className="text-[48px] leading-tight font-sans font-extrabold italic text-[#14B8A6] select-none">
                  9x Fewer
                </p>
                <p className="text-neutral-400 font-sans text-lg font-semibold select-none mt-1">
                  Lower False Positive Rate
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-sans text-sm leading-5 shrink-0 select-none font-medium">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#14B8A6] rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "6%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-300 font-mono text-sm leading-5 text-right select-none font-semibold">
                    2.1%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "59%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    18.4%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    31.2%
                  </p>
                </div>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1 bg-transparent">
              <div className="flex flex-col">
                <p className="text-[48px] leading-tight font-sans font-extrabold italic text-[#14B8A6] select-none">
                  15x Faster
                </p>
                <p className="text-neutral-400 font-sans text-lg font-semibold select-none mt-1">
                  Time to First Finding
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-sans text-sm leading-5 shrink-0 select-none font-medium">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#14B8A6] rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "6%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-300 font-mono text-sm leading-5 text-right select-none font-semibold">
                    3s
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-[1500ms] ease-out"
                      style={{ width: inView ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    47s
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-400 font-sans text-sm leading-5 shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700/30 rounded-full"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <p className="w-12 text-neutral-400 font-mono text-sm leading-5 text-right select-none">
                    N/A
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footnote & Link */}
        <div className="text-center flex flex-col items-center gap-4 mt-2">
          <p className="text-xs text-neutral-500 font-sans max-w-lg leading-relaxed select-none">
            * Internal benchmarks. 50 real-world API collections. Independent audit Q3 2026.
          </p>
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-[#14B8A6] hover:text-[#0D9488] font-semibold transition-colors font-sans mt-1"
            href="/blog/benchmark-methodology"
          >
            View benchmark methodology
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
