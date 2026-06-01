"use client";

interface TokenSpendChartProps {
  data: Array<{ key: string; totalCost: number; totalTokens: number }>;
}

export default function TokenSpendChart({ data }: TokenSpendChartProps) {
  const series =
    data.length > 0
      ? data
      : Array.from({ length: 7 }, (_, i) => ({
          key: `Day ${i + 1}`,
          totalCost: 0,
          totalTokens: 0,
        }));

  const width = 600;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 32, left: 48 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const maxCost = Math.max(...series.map((s) => s.totalCost), 0.01);
  const stepX = series.length > 1 ? iw / (series.length - 1) : iw;

  const costPoints = series.map((s, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + ih - (s.totalCost / maxCost) * ih,
  }));

  const costPath = costPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const costArea = costPoints.length
    ? `${costPath} L ${costPoints[costPoints.length - 1].x.toFixed(1)} ${(pad.top + ih).toFixed(1)} L ${costPoints[0].x.toFixed(1)} ${(pad.top + ih).toFixed(1)} Z`
    : "";

  const totalCost = series.reduce((s, d) => s + d.totalCost, 0);

  return (
    <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Token Spend</h3>
        <span className="text-sm text-gray-400">${totalCost.toFixed(2)} total</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px]">
        {[0, 0.5, 1].map((f, i) => {
          const y = pad.top + ih - f * ih;
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#374151"
                strokeDasharray="3 3"
              />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
                ${(maxCost * f).toFixed(2)}
              </text>
            </g>
          );
        })}
        {costArea && <path d={costArea} fill="#3b82f6" fillOpacity={0.2} />}
        {costPath && <path d={costPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
        {costPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#60a5fa" />
        ))}
      </svg>
    </div>
  );
}
