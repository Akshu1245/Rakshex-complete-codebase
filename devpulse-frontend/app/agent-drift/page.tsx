"use client";
import { useState, useEffect, useRef } from "react";
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

const MOCK_DRIFT_EVENTS: DriftEvent[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    agentName: "customer-support-bot",
    driftType: "cost",
    severity: "high",
    score: 82,
    baseline: 0.0012,
    current: 0.0089,
    description:
      "Cost per call increased 7.4× from baseline — possible infinite loop or context bloat",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    agentName: "code-review-agent",
    driftType: "latency",
    severity: "medium",
    score: 61,
    baseline: 1200,
    current: 3800,
    description: "P95 latency drifted from 1.2s to 3.8s over last 2 hours",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    agentName: "data-pipeline-agent",
    driftType: "behavior",
    severity: "critical",
    score: 95,
    baseline: 0.94,
    current: 0.31,
    description:
      "Output schema compliance dropped from 94% to 31% — agent may be hallucinating structured data",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    agentName: "summarizer-v2",
    driftType: "output",
    severity: "low",
    score: 23,
    baseline: 0.87,
    current: 0.79,
    description: "Semantic similarity to baseline outputs slightly reduced — minor drift detected",
  },
];

export default function AgentDriftPage() {
  const [events, setEvents] = useState<DriftEvent[]>(MOCK_DRIFT_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<DriftEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isMonitoring, setIsMonitoring] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isMonitoring) return;
    // Simulate new drift events in real-time
    intervalRef.current = setInterval(() => {
      const random = Math.random();
      if (random > 0.7) {
        const newEvent: DriftEvent = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          agentName: ["search-agent", "email-bot", "analysis-agent"][Math.floor(Math.random() * 3)],
          driftType: ["cost", "latency", "behavior", "output"][
            Math.floor(Math.random() * 4)
          ] as DriftEvent["driftType"],
          severity: random > 0.9 ? "critical" : random > 0.8 ? "high" : "medium",
          score: Math.round(40 + Math.random() * 55),
          baseline: parseFloat((Math.random() * 2).toFixed(4)),
          current: parseFloat((Math.random() * 10).toFixed(4)),
          description: "Drift detected in agent behavior pattern — review recommended",
        };
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      }
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring]);

  const filtered =
    activeFilter === "all"
      ? events
      : events.filter((e) => e.severity === activeFilter || e.driftType === activeFilter);
  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const highCount = events.filter((e) => e.severity === "high").length;
  const avgDriftScore = Math.round(events.reduce((a, e) => a + e.score, 0) / (events.length || 1));

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
            Detect behavioral drift, cost anomalies, and output degradation in real-time
          </p>
        </div>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isMonitoring ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30" : "bg-[#1E293B] text-gray-400 border border-[#2D3E50]"}`}
        >
          <Activity className={`w-4 h-4 ${isMonitoring ? "animate-pulse" : ""}`} />
          {isMonitoring ? "Monitoring Live" : "Paused"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Active Agents",
            value: new Set(events.map((e) => e.agentName)).size,
            color: "text-[#3B82F6]",
          },
          { label: "Critical Drifts", value: criticalCount, color: "text-[#EF4444]" },
          { label: "High Severity", value: highCount, color: "text-[#F59E0B]" },
          { label: "Avg Drift Score", value: `${avgDriftScore}%`, color: "text-[#00F0FF]" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1E293B] rounded-xl p-5 border border-[#2D3E50]">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "critical", "high", "medium", "low", "cost", "latency", "behavior", "output"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${activeFilter === f ? "bg-[#06D6A0] text-[#0A0E1A]" : "bg-[#1E293B] text-gray-400 hover:bg-[#1E293B]/80 hover:text-white border border-[#2D3E50]"}`}
            >
              {f}
            </button>
          ),
        )}
      </div>

      {/* Events list + detail panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Event list */}
        <div className="lg:col-span-2 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
              <p className="font-medium">No drift events detected</p>
              <p className="text-sm mt-1">Your agents are behaving normally</p>
            </div>
          )}
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`w-full text-left p-4 rounded-xl border transition-all hover:border-[#06D6A0]/40 ${selectedEvent?.id === event.id ? "border-[#06D6A0]/60 bg-[#06D6A0]/5" : "border-[#2D3E50] bg-[#1E293B]/50 hover:bg-[#1E293B]"}`}
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
                      {new Date(event.timestamp).toLocaleTimeString()}
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
        <div className="bg-[#1E293B] rounded-xl border border-[#2D3E50] p-5 h-fit sticky top-6">
          {selectedEvent ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white">Event Detail</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
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
                  <span className="text-[#10B981] font-mono">{selectedEvent.baseline}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current</span>
                  <span className="text-[#EF4444] font-mono">{selectedEvent.current}</span>
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
              <button className="mt-4 w-full py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm font-semibold hover:bg-[#EF4444]/20 transition-all flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Trigger Kill Switch
              </button>
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
