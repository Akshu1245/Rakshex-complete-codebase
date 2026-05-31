"use client";

import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

interface FeatureCardProps {
  title: string;
  description: string;
  link: string;
  iconSvg: string;
}

function FeatureCard({ title, description, link, iconSvg }: FeatureCardProps) {
  return (
    <Link
      href={link}
      className="block w-full bg-[#1A1F2E] border-l-[2px] border-l-[#14B8A6] border-y-0 border-r-0 rounded-lg p-6 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(20,184,166,0.15)] transform group text-left"
    >
      {/* Icon: Teal (#14B8A6), 32x32px */}
      <div className="w-8 h-8 text-[#14B8A6] group-hover:text-[#0D9488] mb-4 transition-colors duration-150">
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(iconSvg) }} />
      </div>

      {/* Title */}
      <h3 className="text-white font-sans text-xl font-semibold mb-2">{title}</h3>

      {/* Description */}
      <p className="text-[#9CA3AF] font-sans text-sm leading-relaxed mb-4">{description}</p>

      {/* Link */}
      <span className="text-[#14B8A6] font-sans text-sm font-semibold inline-flex items-center gap-1 group-hover:underline">
        Learn more{" "}
        <span className="transform group-hover:translate-x-1 transition-transform duration-150">
          &rarr;
        </span>
      </span>
    </Link>
  );
}

export function FeatureCards() {
  const cards = [
    {
      title: "Security Scanner",
      description:
        "87-payload injection library, BOLA/IDOR detection, secret leaks, OWASP Top 10 + PCI DSS v4 mapped.",
      link: "/scanning",
      iconSvg: `
        <svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      `,
    },
    {
      title: "Kill Switch",
      description:
        "Autonomous circuit breaker. Sub-second response. Trips on budget, anomaly, or red-team score.",
      link: "/kill-switch",
      iconSvg: `
        <svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      `,
    },
    {
      title: "Cost Monitor",
      description:
        "Holt-Winters forecasting, anomaly detection, per-model breakdown. Budget caps with kill switch.",
      link: "/token-analytics",
      iconSvg: `
        <svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      `,
    },
  ];

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      {cards.map((card, idx) => (
        <FeatureCard
          key={idx}
          title={card.title}
          description={card.description}
          link={card.link}
          iconSvg={card.iconSvg}
        />
      ))}
    </div>
  );
}
