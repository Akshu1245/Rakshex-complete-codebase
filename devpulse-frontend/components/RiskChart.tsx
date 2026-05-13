"use client";
import React from "react";

// Pure-SVG sparkline chart for cost-velocity. We deliberately avoid
// `recharts` here: with React 19 + the current recharts release, the
// forwardRef'd chart components fail `tsc --noEmit` ("cannot be used as
// a JSX component") and break the production build. Inline SVG is also
// dramatically smaller in the bundle and has no third-party runtime.

interface RiskChartProps {
  data?: number[];
}

export default function RiskChart({ data }: RiskChartProps) {
  const series =
    data && data.length > 0
      ? data
      : Array.from({ length: 12 }, (_, i) => 40 + ((i * 7) % 50));

  const width = 600;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 24, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...series, 1);
  const minVal = Math.min(...series, 0);
  const range = Math.max(maxVal - minVal, 1);
  const avgVal = series.reduce((a, b) => a + b, 0) / series.length;

  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const points = series.map((v, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + innerH - ((v - minVal) / range) * innerH;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
        padding.top + innerH
      ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(
        1
      )} Z`
    : "";

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(
    f => padding.top + innerH - f * innerH
  );

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Cost Velocity (USD/Call)</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded"></div>
            <span className="text-gray-400">Usage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded"></div>
            <span className="text-gray-400">Avg: ${avgVal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-[200px]"
      >
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="#374151"
            strokeDasharray="3 3"
          />
        ))}
        {areaPath && <path d={areaPath} fill="#3b82f6" fillOpacity={0.3} />}
        {linePath && (
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />
        )}
        <text
          x={padding.left - 6}
          y={padding.top + 6}
          textAnchor="end"
          fontSize="10"
          fill="#9CA3AF"
        >
          {maxVal.toFixed(0)}
        </text>
        <text
          x={padding.left - 6}
          y={padding.top + innerH}
          textAnchor="end"
          fontSize="10"
          fill="#9CA3AF"
        >
          {minVal.toFixed(0)}
        </text>
        <text x={padding.left} y={height - 6} fontSize="10" fill="#9CA3AF">
          1
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          fontSize="10"
          fill="#9CA3AF"
        >
          {series.length}
        </text>
      </svg>
    </div>
  );
}
