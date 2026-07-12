"use client";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle, RefreshCw, Activity, Brain, ArrowRight } from "lucide-react";

interface DriftEvent {
  id: string;
  timestamp: string;
  agentName: string;
  driftType: "behavior" | "cost" | "latency" | "output";
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  baseline: number;
  current: number;
  description: string;
}

const DRIFT_COLORS = {
  low: "text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20",
  medium: "text-[#FDB022] bg-[#FDB022]/10 border-[#FDB022]/20",
  high: "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20",
  critical: "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20",
};

function severityForMagnitude(magnitude: number): DriftEvent["severity"] {
  if (magnitude >= 4) return "critical";
  if (magnitude >= 3) return "high";
  if (magnitude >= 2) return "medium";
  return "low";
}

export default function AgentDriftPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Real cost-drift detection from stored AI telemetry (7-day rolling baseline).
  const anomaliesQuery = trpc.analytics.anomalies.useQuery(
    { threshold: 2 },
    { refetchInterval: isMonitoring ? 15000 : false },
  );

  const events: DriftEvent[] = useMemo(() => {
    const rows = anomaliesQuery.data ?? [];
    return rows.map((a) => ({
      id: a.hour,
      timestamp: `${a.hour}:00:00.000Z`,
      agentName: `Cost window ${a.hour.slice(5).replace("T", " ")}:00`,
      driftType: "cost" as const,
      severity: severityForMagnitude(a.magnitude),
      score: Math.min(99, Math.round(a.magnitude * 20)),
      baseline: a.rollingAvg,
      current: a.cost,
      description: `Spend hit $${a.cost.toFixed(2)} vs a 7-day baseline of $${a.rollingAvg.toFixed(2)} (${a.magnitude}× higher) — possible runaway loop, context bloat, or traffic spike.`,
    }));
  }, [anomaliesQuery.data]);

  const filtered =
    activeFilter === "all"
      ? events
      : events.filter((e) => e.severity === activeFilter || e.driftType === activeFilter);
  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;
  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const highCount = events.filter((e) => e.severity === "high").length;
  const avgDriftScore = Math.round(events.reduce((a, e) => a + e.score, 0) / (events.length || 1));
  const loading = anomaliesQuery.isLoading;

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-[#06D6A0]" />
            Agent Drift Monitor
          </h1>
          <p className="text-gray-400 mt-1">
            Cost anomaly &amp; drift detection from your live AI telemetry
          </p>
        </div>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isMonitoring ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30" : "bg-black/50 text-gray-400 border border-[#2D3E50]"}`}
        >
          <Activity className={`w-4 h-4 ${isMonitoring ? "animate-pulse" : ""}`} />
          {isMonitoring ? "Monitoring Live" : "Paused"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Anomalies (14d)", value: events.length, color: "text-[#3B82F6]" },
          { label: "Critical Drifts", value: criticalCount, color: "text-[#EF4444]" },
          { label: "High Severity", value: highCount, color: "text-[#F59E0B]" },
          { label: "Avg Drift Score", value: `${avgDriftScore}%`, color: "text-[#00F0FF]" },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/50 rounded-xl p-5 border border-[#2D3E50]">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "critical", "high", "medium", "low", "cost"].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${activeFilter === f ? "bg-[#06D6A0] text-[#0A0E1A]" : "bg-black/50 text-gray-400 hover:text-white border border-[#2D3E50]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Events list + detail panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Event list */}
        <div className="lg:col-span-2 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-[#2D3E50] bg-black/50 animate-pulse"
                />
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
              <p className="font-medium">No drift events detected</p>
              <p className="text-sm mt-1">
                Your agents are within their cost baseline. Anomalies appear here as telemetry
                accumulates.
              </p>
            </div>
          )}
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedId(event.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all hover:border-[#06D6A0]/40 ${selectedId === event.id ? "border-[#06D6A0]/60 bg-[#06D6A0]/5" : "border-[#2D3E50] bg-black/50 hover:bg-black/70"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize ${DRIFT_COLORS[event.severity]}`}
                    >
                      {event.severity}
                    </span>
                    <span className="text-xs text-gray-500 capitalize bg-gray-700/50 px-2 py-0.5 rounded-full">
                      {event.driftType}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-semibold text-white text-sm">{event.agentName}</p>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{event.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-white">
                    {event.score}
                    <span className="text-xs text-gray-500">%</span>
                  </p>
                  <p className="text-xs text-gray-500">drift score</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="bg-black/50 rounded-xl border border-[#2D3E50] p-5 h-fit sticky top-6">
          {selectedEvent ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white">Event Detail</h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-gray-500 hover:text-gray-300 text-xs"
                >
                  ✕ close
                </button>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full border capitalize ${DRIFT_COLORS[selectedEvent.severity]}`}
              >
                {selectedEvent.severity} · {selectedEvent.driftType}
              </span>
              <p className="font-semibold text-white mt-3">{selectedEvent.agentName}</p>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                {selectedEvent.description}
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Baseline</span>
                  <span className="text-[#10B981] font-mono">${selectedEvent.baseline}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current</span>
                  <span className="text-[#EF4444] font-mono">${selectedEvent.current}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Drift Score</span>
                  <span className="text-[#00F0FF] font-bold">{selectedEvent.score}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Detected</span>
                  <span className="text-gray-300 text-xs">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-[#2D3E50]">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Recommended Actions
                </p>
                <div className="space-y-2">
                  {[
                    "Review agent logs for this time window",
                    "Compare current vs baseline prompts",
                    selectedEvent.severity === "critical"
                      ? "Trigger kill switch if runaway"
                      : "Set cost alert threshold",
                  ].map((action) => (
                    <div key={action} className="flex items-start gap-2 text-xs text-gray-400">
                      <ArrowRight className="w-3 h-3 text-[#06D6A0] shrink-0 mt-0.5" />
                      {action}
                    </div>
                  ))}
                </div>
              </div>
              <a
                href="/kill-switch"
                className="mt-4 w-full py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm font-semibold hover:bg-[#EF4444]/20 transition-all flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> Open Kill Switch
              </a>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select an event to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
