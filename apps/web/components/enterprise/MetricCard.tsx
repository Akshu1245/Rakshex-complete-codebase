"use client";
import { type ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: "teal" | "green" | "yellow" | "red" | "blue" | "purple" | "orange" | "gray";
  trend?: { value: number; label: string; positive?: boolean };
  children?: ReactNode;
}

const colorMap = {
  teal: { text: "text-[#14b8a6]", bg: "bg-[#14b8a6]/10", border: "border-[#14b8a6]/20" },
  green: { text: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
  yellow: { text: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  red: { text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  blue: { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  purple: { text: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  gray: { text: "text-gray-300", bg: "bg-gray-300/10", border: "border-gray-300/20" },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = "teal",
  trend,
  children,
}: MetricCardProps) {
  const c = colorMap[color];
  return (
    <div className={`glass-card rounded-xl p-5 border ${c.border} entrance-anim`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
        {icon && <span className={`material-symbols-outlined ${c.text} text-xl`}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${c.text} font-mono`}>{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      {trend && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className={`material-symbols-outlined text-sm ${trend.positive ? "text-green-400" : "text-red-400"}`}
          >
            {trend.positive ? "trending_up" : "trending_down"}
          </span>
          <span
            className={`text-xs font-medium ${trend.positive ? "text-green-400" : "text-red-400"}`}
          >
            {trend.value}% {trend.label}
          </span>
        </div>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
