"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sliders, Layers, Grid, ShieldCheck } from "lucide-react";

interface SubNavProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOverviewClick?: () => void;
}

export function ComparisonSubNav({
  activeTab = "architecture",
  onTabChange,
  onOverviewClick,
}: SubNavProps) {
  const [currentTab, setCurrentTab] = useState<string>(activeTab);

  const tabs = [
    { id: "overview", label: "Cloud Overview", icon: Layers, href: "/overview" },
    {
      id: "architecture",
      label: "Session vs Action Control",
      icon: Sliders,
      href: "#architecture-slider",
    },
    { id: "matrix", label: "1-on-1 Competitor Matrix", icon: Grid, href: "#one-on-one-matrix" },
    { id: "features", label: "Governance Features", icon: ShieldCheck, href: "#features" },
  ];

  return (
    <div className="w-full flex justify-center py-4 px-4 sticky top-16 z-40 pointer-events-none">
      <div className="pointer-events-auto bg-[#0B0F17]/90 backdrop-blur-xl border border-[#14B8A6]/30 shadow-2xl rounded-full p-1.5 flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentTab === t.id;
          return (
            <Link
              key={t.id}
              href={t.href}
              onClick={() => {
                setCurrentTab(t.id);
                if (onTabChange) onTabChange(t.id);
                if (t.id === "overview" && onOverviewClick) onOverviewClick();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-[#14B8A6] text-white shadow-[0_0_12px_rgba(20,184,166,0.4)] scale-[1.02]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
