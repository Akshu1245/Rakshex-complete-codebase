"use client";

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#6366f1",
];

interface ModelMixChartProps {
  data: Array<{ provider: string; model: string; totalCost: number }>;
}

export default function ModelMixChart({ data }: ModelMixChartProps) {
  const total = data.reduce((s, d) => s + d.totalCost, 0) || 1;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const strokeW = 24;

  let angle = -Math.PI / 2;
  const slices = data.slice(0, 8).map((d, i) => {
    const pct = d.totalCost / total;
    const sweep = pct * 2 * Math.PI;
    const start = angle;
    angle += sweep;
    return { ...d, pct, start, sweep, color: COLORS[i % COLORS.length] };
  });

  function arcPath(start: number, sweep: number): string {
    if (sweep >= 2 * Math.PI - 0.001) sweep = 2 * Math.PI - 0.001;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(start + sweep);
    const y2 = cy + r * Math.sin(start + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  return (
    <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Model Mix</h3>
      <div className="flex items-start gap-6">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={strokeW} />
          {slices.map((s, i) => (
            <path
              key={i}
              d={arcPath(s.start, s.sweep)}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
            />
          ))}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#f9fafb"
          >
            ${total.toFixed(0)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#9CA3AF">
            total
          </text>
        </svg>
        <div className="space-y-2 flex-1 min-w-0">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-gray-300 truncate">{s.model}</span>
              <span className="text-gray-500 ml-auto shrink-0">{(s.pct * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
