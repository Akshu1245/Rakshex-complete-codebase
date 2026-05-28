"use client";

import Link from "next/link";

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
      className="relative group block w-full h-[320px] bg-[#0d0d0d] hover:bg-[#111111] p-10 overflow-hidden select-none transition-colors duration-200"
    >
      {/* Ghost cursor on hover */}
      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-35">
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
          <path
            d="M0 0L0 36L9 27L14 38L18 36L13 25L24 25Z"
            fill="rgba(255,255,255,0.15)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Top isometric 3D wireframe icon */}
      <div className="w-[120px] h-[120px] text-white/15 group-hover:text-white/30 transition-colors duration-200">
        <div dangerouslySetInnerHTML={{ __html: iconSvg }} />
      </div>

      {/* Bottom text area */}
      <div className="absolute bottom-10 left-10 right-10">
        <h3 className="text-white font-sans text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-white/50 font-sans text-sm leading-relaxed mt-3 max-w-[280px]">
          {description}
        </p>
      </div>
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
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric Layered Shield -->
          <path d="M60 15 L95 32.5 L95 72.5 L60 90 L25 72.5 L25 32.5 Z" />
          <path d="M60 25 L85 37.5 L85 67.5 L60 80 L35 67.5 L35 37.5 Z" stroke-dasharray="3,3" />
          <path d="M60 35 L75 42.5 L75 62.5 L60 70 L45 62.5 L45 42.5 Z" />
          <!-- Vertical spine lines -->
          <line x1="60" y1="15" x2="60" y2="90" />
          <line x1="25" y1="32.5" x2="60" y2="50" />
          <line x1="95" y1="32.5" x2="60" y2="50" />
          <line x1="25" y1="72.5" x2="60" y2="90" />
          <line x1="95" y1="72.5" x2="60" y2="90" />
        </svg>
      `,
    },
    {
      title: "Kill Switch",
      description:
        "Autonomous circuit breaker. Sub-second response. Trips on budget, anomaly, or red-team score.",
      link: "/kill-switch",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric 3D Circuit Breaker / Switch -->
          <path d="M30 45 L60 30 L90 45 L60 60 Z" />
          <path d="M30 45 L30 75 L60 90 L60 60 Z" />
          <path d="M90 45 L90 75 L60 90 L60 60 Z" />
          <!-- Dotted cylinder grid background -->
          <ellipse cx="60" cy="45" rx="15" ry="7.5" />
          <!-- The switch lever -->
          <line x1="60" y1="45" x2="60" y2="20" stroke-width="2" />
          <circle cx="60" cy="20" r="3" fill="currentColor" />
          <line x1="30" y1="45" x2="60" y2="30" />
          <line x1="90" y1="45" x2="60" y2="30" />
        </svg>
      `,
    },
    {
      title: "Cost Monitor",
      description:
        "Holt-Winters forecasting, anomaly detection, per-model breakdown. Budget caps with kill switch.",
      link: "/token-analytics",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Stack of Isometric Cylinders (Coins) -->
          <!-- Top Coin -->
          <ellipse cx="40" cy="70" rx="20" ry="10" />
          <path d="M20 70 V80 A20 10 0 0 0 60 80 V70" />
          <!-- Coin 2 -->
          <ellipse cx="60" cy="55" rx="20" ry="10" />
          <path d="M40 55 V65 A20 10 0 0 0 80 65 V55" />
          <!-- Coin 3 -->
          <ellipse cx="80" cy="40" rx="20" ry="10" />
          <path d="M60 40 V50 A20 10 0 0 0 100 50 V40" />
          <!-- Connecting Grid Lines -->
          <line x1="40" y1="70" x2="60" y2="55" stroke-dasharray="2,2" />
          <line x1="60" y1="55" x2="80" y2="40" stroke-dasharray="2,2" />
        </svg>
      `,
    },
    {
      title: "Thinking Token Attribution",
      description:
        "World-first isolation of reasoning tokens. Full pricing tables for all providers. Patent NHCE/DEV/2026/002.",
      link: "/token-analytics",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric Neural Wireframe / Brain Structure -->
          <!-- Isometric cube boundaries -->
          <path d="M60 20 L95 37.5 L95 82.5 L60 100 L25 82.5 L25 37.5 Z" stroke-dasharray="3,3" />
          <!-- Inner floating nodes and connections -->
          <circle cx="60" cy="40" r="2.5" fill="currentColor" />
          <circle cx="45" cy="50" r="2.5" fill="currentColor" />
          <circle cx="75" cy="50" r="2.5" fill="currentColor" />
          <circle cx="60" cy="65" r="2.5" fill="currentColor" />
          <circle cx="45" cy="75" r="2.5" fill="currentColor" />
          <circle cx="75" cy="75" r="2.5" fill="currentColor" />
          <circle cx="60" cy="85" r="2.5" fill="currentColor" />
          
          <line x1="60" y1="40" x2="45" y2="50" />
          <line x1="60" y1="40" x2="75" y2="50" />
          <line x1="45" y1="50" x2="60" y2="65" />
          <line x1="75" y1="50" x2="60" y2="65" />
          <line x1="60" y1="65" x2="45" y2="75" />
          <line x1="60" y1="65" x2="75" y2="75" />
          <line x1="45" y1="75" x2="60" y2="85" />
          <line x1="75" y1="75" x2="60" y2="85" />
          <line x1="45" y1="50" x2="45" y2="75" stroke-dasharray="2,2" />
          <line x1="75" y1="50" x2="75" y2="75" stroke-dasharray="2,2" />
        </svg>
      `,
    },
    {
      title: "Shadow API Discovery",
      description:
        "Static route extraction for Express, FastAPI, Flask, Django, Spring Boot, Laravel.",
      link: "/shadow-apis",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Stacked isometric sheets (layers) -->
          <!-- Top sheet -->
          <path d="M60 20 L95 37.5 L60 55 L25 37.5 Z" />
          <!-- Middle sheet -->
          <path d="M60 42.5 L95 60 L60 77.5 L25 60 Z" />
          <!-- Bottom sheet -->
          <path d="M60 65 L95 82.5 L60 100 L25 82.5 Z" />
          <!-- Connecting vertical lines -->
          <line x1="25" y1="37.5" x2="25" y2="82.5" stroke-dasharray="2,2" />
          <line x1="60" y1="55" x2="60" y2="100" stroke-dasharray="2,2" />
          <line x1="95" y1="37.5" x2="95" y2="82.5" stroke-dasharray="2,2" />
          <line x1="60" y1="20" x2="60" y2="65" stroke-dasharray="2,2" />
        </svg>
      `,
    },
    {
      title: "Credential Scanner",
      description:
        "10-rule secret detection: AWS, GitHub, OpenAI, Stripe. Aadhaar + PAN for India compliance.",
      link: "/scanning",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric key/lock shape -->
          <path d="M45 40 L75 25 L95 35 L65 50 Z" />
          <path d="M45 40 L45 70 L65 80 L65 50 Z" />
          <path d="M95 35 L95 65 L65 80" />
          <ellipse cx="65" cy="37.5" rx="8" ry="4" />
          <!-- Key shaft going down -->
          <line x1="65" y1="37.5" x2="65" y2="95" stroke-width="2" />
          <path d="M65 75 L75 80 V85 L65 80" />
          <path d="M65 85 L75 90 V95 L65 90" />
        </svg>
      `,
    },
    {
      title: "Compliance Reports",
      description:
        "SOC2 evidence builder, PCI DSS v4.0.1, OWASP scores. Export JSON, CSV, PDF. Vanta/Drata ready.",
      link: "/compliance",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric clipboard/document -->
          <path d="M40 30 L80 10 L100 20 L60 40 Z" />
          <path d="M40 30 L40 90 L60 100 L60 40 Z" />
          <path d="M100 20 L100 80 L60 100" />
          <!-- Lines on document -->
          <line x1="50" y1="45" x2="80" y2="30" />
          <line x1="50" y1="58" x2="80" y2="43" />
          <line x1="50" y1="71" x2="80" y2="56" />
          <line x1="50" y1="84" x2="70" y2="74" />
        </svg>
      `,
    },
    {
      title: "MCP Governance",
      description:
        "MCP tool registry, risk scoring, approval workflows. Tool-call allowlists per agent.",
      link: "/collections",
      iconSvg: `
        <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- Isometric Globe/Network Globe -->
          <circle cx="60" cy="60" r="35" />
          <!-- Ellipses for grid -->
          <ellipse cx="60" cy="60" rx="35" ry="12" />
          <ellipse cx="60" cy="60" rx="12" ry="35" />
          <!-- Isometric structural diagonals -->
          <line x1="25" y1="60" x2="95" y2="60" />
          <line x1="60" y1="25" x2="60" y2="95" />
          <!-- Outer box bounding -->
          <path d="M20 20 L100 20 L100 100 L20 100 Z" stroke-dasharray="3,3" />
        </svg>
      `,
    },
  ];

  return (
    <div className="w-full bg-[#1e1e1e] p-[1px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[1px] items-stretch select-none">
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
