"use client";

export function TestimonialsSection() {
  const testimonials = [
    {
      initials: "DR",
      author: "Devesh R.",
      title: "CTO, Fintech Corp",
      quote:
        "RakshEx discovered a live production API credential in our codebase during staging scan. Incredibly fast.",
    },
    {
      initials: "AK",
      author: "Aarti K.",
      title: "AppSec Director, DevScale",
      quote:
        "The runtime kill switch stopped an infinite LLM agent loop that would have cost us thousands. Lifesaver.",
    },
    {
      initials: "SS",
      author: "Siddharth S.",
      title: "Security Architect, PaySafe",
      quote:
        "SOC2 compliance readiness package built in one click. Our auditor was extremely impressed by the evidence.",
    },
    {
      initials: "PP",
      author: "Priya P.",
      title: "Lead Developer, NeoBank",
      quote:
        "We isolated 45% of our monthly model invoice down to reasoning token overhead. Brilliant attribution tool.",
    },
    {
      initials: "NG",
      author: "Nikhil G.",
      title: "Founder, SaaSify",
      quote:
        "Integrating the scanner into our GitHub actions pipeline took 3 minutes. High quality security checks.",
    },
  ];

  return (
    <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-[#0F1419]">
      <div className="flex flex-col items-center gap-12">
        {/* Section Title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold text-[#14B8A6] uppercase tracking-widest bg-[#14B8A6]/10 px-3 py-1 rounded-full border border-[#14B8A6]/20">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-[36px] font-bold text-white font-sans leading-tight tracking-[-0.02em] mt-2">
            Trusted by Engineering Leaders
          </h2>
        </div>

        {/* 5-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="bg-[#1A1F2E] border-t-[3px] border-t-[#14B8A6] border-x-0 border-b-0 rounded-lg p-5 flex flex-col justify-between items-start gap-4 select-none hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(20,184,166,0.15)] transform transition-all duration-200 group text-left"
            >
              {/* Top Section: Stars and Quote */}
              <div className="flex flex-col gap-3">
                {/* Stars: teal, 16px */}
                <div className="text-[#14B8A6] text-[16px] leading-none tracking-wider">★★★★★</div>
                {/* Quote: White, 14px, italic */}
                <p className="text-white text-[14px] italic leading-relaxed text-left font-sans">
                  "{t.quote}"
                </p>
              </div>

              {/* Bottom Section: Avatar and Author Info */}
              <div className="flex items-center gap-3 mt-2">
                {/* Avatar: 32x32px, teal background, white initials */}
                <div className="w-8 h-8 shrink-0 bg-[#14B8A6] text-white font-bold flex items-center justify-center rounded-full text-xs uppercase group-hover:scale-110 transition-transform duration-150">
                  {t.initials}
                </div>
                <div className="text-left leading-tight">
                  {/* Author: White, 14px, weight 600 */}
                  <h4 className="text-white text-[14px] font-semibold font-sans">{t.author}</h4>
                  {/* Title: Gray (#9CA3AF), 12px */}
                  <p className="text-[#9CA3AF] text-[12px] font-sans">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
