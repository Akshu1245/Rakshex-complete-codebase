"use client";

import Link from "next/link";
import {
  Shield,
  Power,
  BarChart2,
  Brain,
  Ghost,
  Key,
  FileText,
  Network,
  type LucideIcon,
} from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  animClass: string;
}

function FeatureCard({ title, description, link, icon: Icon, animClass }: FeatureCardProps) {
  return (
    <Link
      href={link}
      className="block w-full bg-transparent border border-[#14B8A6]/10 hover:border-[#14B8A6]/35 rounded-lg p-6 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(20,184,166,0.15)] transform group text-left anti-gravity-float"
    >
      {/* Icon: Teal (#14B8A6), 32x32px */}
      <div className="w-8 h-8 text-[#14B8A6] group-hover:text-[#0D9488] mb-4 transition-colors duration-150">
        <Icon className={`w-8 h-8 transition-transform duration-150 ${animClass}`} />
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
      description: "87-payload library. OWASP API Top 10. PCI DSS v4.0.1.",
      link: "/features#security-scanner",
      icon: Shield,
      animClass: "animate-pulse-shield",
    },
    {
      title: "Kill Switch",
      description: "Sub-second circuit breaker. Trips on budget, anomaly, or score.",
      link: "/features#kill-switch",
      icon: Power,
      animClass: "animate-glow-power",
    },
    {
      title: "Cost Monitor",
      description: "Holt-Winters forecasting. Per-model breakdown. Budget caps.",
      link: "/features#cost-monitor",
      icon: BarChart2,
      animClass: "animate-bounce-graph",
    },
    {
      title: "Thinking Tokens",
      description: "Reasoning-token attribution when provider metadata is available.",
      link: "/features#thinking-tokens",
      icon: Brain,
      animClass: "animate-pulse-brain",
    },
    {
      title: "Shadow API Discovery",
      description: "Static route extraction. Express, FastAPI, Flask, Django, Spring.",
      link: "/features#shadow-api",
      icon: Ghost,
      animClass: "animate-fade-ghost",
    },
    {
      title: "Credential Scanner",
      description: "AWS, GitHub, OpenAI, Stripe. Aadhaar + PAN for India.",
      link: "/features#credentials",
      icon: Key,
      animClass: "animate-rotate-key",
    },
    {
      title: "Compliance Reports",
      description: "SOC2, PCI DSS, OWASP. JSON, CSV, PDF. Vanta/Drata ready.",
      link: "/features#compliance",
      icon: FileText,
      animClass: "animate-draw-check",
    },
    {
      title: "MCP Governance",
      description: "Tool registry, risk scoring, approval workflows per agent.",
      link: "/features#mcp",
      icon: Network,
      animClass: "animate-connect-network",
    },
  ];

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
      {cards.map((card, idx) => (
        <FeatureCard
          key={idx}
          title={card.title}
          description={card.description}
          link={card.link}
          icon={card.icon}
          animClass={card.animClass}
        />
      ))}
    </div>
  );
}
