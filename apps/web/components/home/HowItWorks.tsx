"use client";

import { FileSearch, ShieldCheck, FileBarChart } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Point at your collection",
    description:
      "Upload your Postman collection, OpenAPI spec, or Bruno file. RaksHex parses every endpoint, header, and parameter.",
    icon: FileSearch,
  },
  {
    number: "02",
    title: "Scan 20+ vulnerability patterns",
    description:
      "Detect hardcoded API keys, exposed JWTs, weak passwords, SQL injection risks, open CORS, verbose errors, and more.",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Get a security score + shareable report",
    description:
      "See your security score out of 100. Share the report with your team or fix issues directly in VS Code.",
    icon: FileBarChart,
  },
];

export function HowItWorks() {
  return (
    <section
      className="w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-transparent"
      id="how-it-works"
    >
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-[36px] font-bold font-sans text-white leading-tight tracking-[-0.02em] mb-4">
          How It Works
        </h2>
        <p className="text-[#9CA3AF] text-base max-w-lg mx-auto">
          From collection to security report in under 10 seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="relative bg-transparent border border-white/10 rounded-xl p-8 hover:border-[#14B8A6]/30 transition-all group"
            >
              <div className="absolute -top-4 left-6 bg-black/60 border border-white/10 rounded-lg px-3 py-1">
                <span className="text-[#14B8A6] font-mono text-sm font-bold">{step.number}</span>
              </div>
              <div className="mt-4 mb-6 w-12 h-12 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center group-hover:bg-[#14B8A6]/20 transition-colors">
                <Icon className="w-6 h-6 text-[#14B8A6]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">{step.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
