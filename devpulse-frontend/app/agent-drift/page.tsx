"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Activity, Brain, ArrowRight } from "lucide-react";

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
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function AgentDriftPage() {
  // Real drift events stream in via the agent telemetry pipeline once
  // it's wired up server-side. Until then the page renders an honest
  // empty state instead of hardcoded sample data.
  const events: DriftEvent[] = [];
  const [selectedEvent, setSelectedEvent] = useState<DriftEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isMonitoring, setIsMonitoring] = useState(true);

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
            <Brain className="w-8 h-8 text-purple-400" />
            Agent Drift Monitor
          </h1>
          <p className="text-gray-400 mt-1">
            Detect behavioral drift, cost anomalies, and output degradation in real-time
          </p>
        </div>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isMonitoring ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-gray-700 text-gray-400 border border-gray-600"}`}
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
            color: "text-blue-400",
          },
          { label: "Critical Drifts", value: criticalCount, color: "text-red-400" },
          { label: "High Severity", value: highCount, color: "text-orange-400" },
          { label: "Avg Drift Score", value: `${avgDriftScore}%`, color: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${activeFilter === f ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"}`}
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
              <p className="font-medium">No drift events yet</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                Drift detection activates once your agents start emitting telemetry. Connect a
                workload to begin monitoring.
              </p>
              <Link
                href="/dashboard/telemetry"
                className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-400 hover:text-indigo-300"
              >
                Set up agent telemetry <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`w-full text-left p-4 rounded-xl border transition-all hover:border-indigo-500/40 ${selectedEvent?.id === event.id ? "border-indigo-500/60 bg-indigo-500/5" : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"}`}
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
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 h-fit sticky top-6">
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
                  <span className="text-green-400 font-mono">{selectedEvent.baseline}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current</span>
                  <span className="text-red-400 font-mono">{selectedEvent.current}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Drift Score</span>
                  <span className="text-purple-400 font-bold">{selectedEvent.score}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Detected</span>
                  <span className="text-gray-300 text-xs">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-700">
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
                      <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      {action}
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-4 w-full py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
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
