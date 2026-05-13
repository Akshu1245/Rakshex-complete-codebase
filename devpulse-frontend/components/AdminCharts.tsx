"use client";

import { useMemo } from "react";

interface User {
  id: number;
  email: string;
  plan: string;
  created_at?: string;
  name?: string;
}

/**
 * Inline SVG signup chart. Deliberately dependency-free — Recharts isn't
 * installed in devpulse-frontend and we don't want to expand the bundle
 * just to render ~30 bars. Computes counts client-side from the existing
 * admin users list, so no new backend endpoint is required.
 */
export function AdminSignupChart({ users }: { users: User[] }) {
  const { bars, max, totalThisMonth } = useMemo(() => {
    const now = new Date();
    const days: { label: string; count: number; iso: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, label: iso.slice(5), count: 0 });
    }

    for (const u of users) {
      if (!u.created_at) continue;
      const iso = u.created_at.slice(0, 10);
      const day = days.find(d => d.iso === iso);
      if (day) day.count++;
    }

    const max = Math.max(1, ...days.map(d => d.count));
    const totalThisMonth = days.reduce((sum, d) => sum + d.count, 0);
    return { bars: days, max, totalThisMonth };
  }, [users]);

  const width = 560;
  const height = 180;
  const padding = { top: 16, right: 8, bottom: 24, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = chartW / bars.length;

  const yTicks = [0, Math.ceil(max / 2), max];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-3xl font-bold text-blue-300">{totalThisMonth}</p>
        <p className="text-xs text-gray-500">new signups · 30d window</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Daily signups for the last 30 days"
      >
        {yTicks.map(t => {
          const y = padding.top + chartH - (t / max) * chartH;
          return (
            <g key={t}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#374151"
                strokeDasharray="2 2"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="#9ca3af"
                fontSize="9"
              >
                {t}
              </text>
            </g>
          );
        })}
        {bars.map((d, i) => {
          const h = (d.count / max) * chartH;
          const x = padding.left + i * barW + 1;
          const y = padding.top + chartH - h;
          return (
            <g key={d.iso}>
              <rect
                x={x}
                y={y}
                width={Math.max(1, barW - 2)}
                height={h}
                fill={d.count > 0 ? "#3b82f6" : "#1f2937"}
                rx="1"
              >
                <title>{`${d.iso}: ${d.count} signup${d.count === 1 ? "" : "s"}`}</title>
              </rect>
            </g>
          );
        })}
        {bars
          .filter((_, i) => i % 5 === 0 || i === bars.length - 1)
          .map(d => {
            const i = bars.indexOf(d);
            const x = padding.left + i * barW + barW / 2;
            return (
              <text
                key={d.iso}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="9"
              >
                {d.label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

/**
 * Plan-mix donut (free vs pro vs enterprise). Same dependency-free
 * principle — plain SVG arc math.
 */
export function AdminPlanMixChart({ users }: { users: User[] }) {
  const totals = useMemo(() => {
    const counts = { free: 0, pro: 0, enterprise: 0 };
    for (const u of users) {
      const key = (u.plan || "free") as keyof typeof counts;
      if (key in counts) counts[key]++;
    }
    const total = counts.free + counts.pro + counts.enterprise;
    return { counts, total: Math.max(1, total) };
  }, [users]);

  const segments = [
    { key: "enterprise", color: "#a855f7", label: "Enterprise" },
    { key: "pro", color: "#3b82f6", label: "Pro" },
    { key: "free", color: "#4b5563", label: "Free" },
  ] as const;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 64;
  const strokeW = 20;

  let offset = 0;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Plan distribution"
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#1f2937"
            strokeWidth={strokeW}
          />
          {segments.map(seg => {
            const value = totals.counts[seg.key];
            const frac = value / totals.total;
            const length = frac * circumference;
            const circle = (
              <circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeW}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += length;
            return circle;
          })}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fill="#f3f4f6"
            fontSize="20"
            fontWeight="700"
          >
            {totals.counts.pro + totals.counts.enterprise}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            paid users
          </text>
        </svg>
      </div>
      <ul className="text-xs w-full space-y-1">
        {segments.map(seg => (
          <li
            key={seg.key}
            className="flex items-center justify-between text-gray-300"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              {seg.label}
            </span>
            <span className="font-mono">{totals.counts[seg.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
