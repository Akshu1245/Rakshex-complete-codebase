"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import PlanUtilizationBanner from "../../components/PlanUtilizationBanner";

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

interface LiveLog {
  id: string;
  time: string;
  agent: string;
  cost: number;
  anomaly: boolean;
  model?: string;
  status: string;
}

export default function Dashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
  const [liveCost, setLiveCost] = useState(0);

  // Real tRPC data
  const overviewQuery = trpc.analytics.overview.useQuery(undefined, {
    refetchInterval: 15000,
    retry: 2,
  });

  const anomaliesQuery = trpc.analytics.anomalies.useQuery(
    { threshold: 2 },
    { refetchInterval: 30000, retry: 2 },
  );

  const overview = overviewQuery.data;
  const loading = overviewQuery.isLoading;

  // Socket.IO real-time
  const connectSocket = useCallback(() => {
    const url = getSocketUrl();
    if (!url) return;

    const s = io(url, {
      path: "/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 5,
    });

    s.on("connect", () => {
      setConnected(true);
      setSocket(s);
    });

    s.on("disconnect", () => {
      setConnected(false);
      setSocket(null);
    });

    s.on("message", (msg: { type: string; data?: any }) => {
      if (msg.type === "cost_update" && msg.data) {
        setLiveCost((prev) => prev + (msg.data.cost || 0));
        const newLog: LiveLog = {
          id: `${Date.now()}_${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          agent: msg.data.model || "live-agent",
          cost: msg.data.cost || 0,
          anomaly: msg.data.anomaly || false,
          model: msg.data.model,
          status: msg.data.anomaly ? "error" : "success",
        };
        setLiveLogs((prev) => [newLog, ...prev].slice(0, 50));
      }
    });

    return s;
  }, []);

  useEffect(() => {
    const s = connectSocket();
    return () => {
      s?.disconnect();
    };
  }, [connectSocket]);

  // Merge overview events + live Socket.IO events
  const displayLogs: LiveLog[] = useMemo(() => {
    const base: LiveLog[] =
      overview?.recentEvents.map((e: any) => ({
        id: e.id,
        time: new Date(e.timestamp).toLocaleTimeString(),
        agent: e.agent || "unknown",
        cost: e.cost,
        anomaly: e.anomaly,
        model: e.model,
        status: e.status,
      })) ?? [];

    const merged = new Map<string, LiveLog>();
    for (const log of base) merged.set(log.id, log);
    for (const log of liveLogs) merged.set(log.id, log);

    return Array.from(merged.values())
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 50);
  }, [overview?.recentEvents, liveLogs]);

  const totalCost = liveCost + (overview?.todayCost || 0);
  const activeAgents = overview?.activeAgents ?? 0;
  const todayRequests = overview?.todayRequests ?? 0;
  const hasAnomaly = overview?.hasAnomaly || (anomaliesQuery.data?.length ?? 0) > 0;
  const anomalyCount = anomaliesQuery.data?.length ?? 0;
  const threatBars = overview?.threatBars ?? new Array(12).fill(0);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
      labels.push(`${String(d.getHours()).padStart(2, "0")}:00`);
    }
    return labels;
  }, []);

  return (
    <div className="p-6 min-h-screen bg-surface-base text-on-surface font-body-md relative overflow-x-hidden">
      {/* Top Background Scan line decoration */}
      <div className="scan-line pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        {/* Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
              Command Center
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-lg border border-glass">
                <span className="material-symbols-outlined text-[16px] text-primary pulse-emerald">
                  sensors
                </span>
                <span className="font-label-mono text-label-mono uppercase tracking-widest text-primary">
                  {connected ? "Live Feed: Connected" : "Feed: Offline"}
                </span>
              </span>
              <span className="text-sm text-on-surface-variant font-label-mono">
                System Overview & Threat Telemetry
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/report"
              className="px-4 py-2 bg-primary text-on-primary font-button-text font-bold rounded-lg emerald-glow hover:opacity-90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Generate Report
            </Link>
            <Link
              href="/metrics"
              className="px-4 py-2 border border-glass text-on-surface hover:bg-surface-container-low font-button-text font-bold rounded-lg transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">insights</span>
              Full Metrics
            </Link>
          </div>
        </div>

        <PlanUtilizationBanner />

        {/* Empty state for no telemetry */}
        {overview && overview.todayRequests === 0 && displayLogs.length === 0 && !loading && (
          <div className="glass-card p-8 text-center border border-dashed border-glass">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
              radar
            </span>
            <h3 className="font-headline-md text-white font-bold mb-2">No Telemetry Data Yet</h3>
            <p className="text-sm text-on-surface-variant max-w-lg mx-auto mb-4">
              Your dashboard populates automatically once you start sending AI events through the
              RaksHex SDK or run your first scan.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/scanning"
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 transition-all"
              >
                Run a Scan
              </Link>
              <Link
                href="/docs"
                className="px-4 py-2 border border-glass rounded-lg text-sm hover:bg-surface-container-low transition-all"
              >
                View SDK Docs
              </Link>
            </div>
          </div>
        )}

        {/* Bento Hero Grid — Real Data */}
        <div className="grid grid-cols-12 gap-6">
          {/* Total Real-time Spend */}
          <div
            className="col-span-12 md:col-span-4 glass-card p-6 entrance-anim relative overflow-hidden"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-mono text-[11px] uppercase tracking-wider">
                Total Real-time Spend
              </span>
              <span className="material-symbols-outlined text-primary">payments</span>
            </div>
            <h2 className="font-headline-xl text-headline-xl text-primary font-bold">
              $
              {loading
                ? "—"
                : totalCost < 0.01 && totalCost > 0
                  ? totalCost.toFixed(4)
                  : totalCost.toFixed(2)}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-status-success font-label-mono text-xs">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>{overview?.todayRequests ?? 0} requests today</span>
            </div>
          </div>

          {/* Active AI Agents */}
          <div
            className="col-span-12 md:col-span-4 glass-card p-6 entrance-anim"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-mono text-[11px] uppercase tracking-wider">
                Active AI Agents
              </span>
              <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            <div className="flex items-end gap-3">
              <h2 className="font-headline-xl text-headline-xl text-white font-bold">
                {loading ? "—" : activeAgents}
              </h2>
              <span className="font-body-md text-on-surface-variant pb-2">
                {activeAgents === 1 ? "agent" : "agents"} tracked
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {activeAgents > 0 ? (
                <>
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                      A1
                    </div>
                    {activeAgents > 1 && (
                      <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                        A2
                      </div>
                    )}
                    {activeAgents > 2 && (
                      <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                        A3
                      </div>
                    )}
                  </div>
                  {activeAgents > 3 && (
                    <span className="text-xs text-on-surface-variant font-label-mono">
                      +{activeAgents - 3} more
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-on-surface-variant font-label-mono">
                  No active agents
                </span>
              )}
            </div>
          </div>

          {/* API Traffic Volume */}
          <div
            className="col-span-12 md:col-span-4 glass-card p-6 entrance-anim"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-mono text-[11px] uppercase tracking-wider">
                API Traffic Volume
              </span>
              <span className="material-symbols-outlined text-primary">dataset</span>
            </div>
            <h2 className="font-headline-xl text-headline-xl text-white font-bold">
              {loading ? "—" : todayRequests.toLocaleString()}
              <span className="text-headline-md text-on-surface-variant ml-1">reqs today</span>
            </h2>
            <div className="mt-4 w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary shadow-[0_0_8px_#6ee7b7] transition-all duration-500"
                style={{
                  width: `${Math.min(100, todayRequests > 0 ? 15 + (todayRequests / 1000) * 85 : 0)}%`,
                }}
              ></div>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant font-label-mono">
              {overview?.todayErrors ?? 0} errors today
            </p>
          </div>
        </div>

        {/* Threat Map and Incident Section */}
        <div className="grid grid-cols-12 gap-6">
          {/* Central Chart: Threat Detection */}
          <div
            className="col-span-12 lg:col-span-8 glass-card p-6 flex flex-col entrance-anim"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-headline-md text-headline-md text-white font-bold">
                  Threat Detection Over Time
                </h3>
                <p className="text-xs text-on-surface-variant font-label-mono">
                  Live hourly monitoring across global gateways
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-[10px] font-label-mono border border-glass rounded hover:bg-primary/10 transition-colors">
                  1H
                </button>
                <button className="px-3 py-1 text-[10px] font-label-mono bg-primary/20 border border-primary/40 text-primary rounded transition-colors">
                  24H
                </button>
                <button className="px-3 py-1 text-[10px] font-label-mono border border-glass rounded hover:bg-primary/10 transition-colors">
                  7D
                </button>
              </div>
            </div>
            {/* Real threat bars from telemetry */}
            <div className="flex-grow flex items-end justify-between gap-2 pt-4 min-h-[220px]">
              {threatBars.map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t-sm relative group cursor-pointer h-full"
                >
                  <div
                    style={{ height: `${Math.max(5, height)}%` }}
                    className="absolute bottom-0 w-full bg-primary rounded-t-sm group-hover:brightness-125 transition-all shadow-[0_0_8px_rgba(110,231,183,0.3)]"
                  ></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-label-mono text-on-surface-variant">
              {timeLabels.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
          </div>

          {/* Right Panel: Anomaly Status */}
          <div
            className="col-span-12 lg:col-span-4 glass-card flex flex-col entrance-anim overflow-hidden"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="p-6 border-b border-glass">
              <h3 className="font-headline-md text-headline-md text-white font-bold">
                Anomaly Status
              </h3>
              <p className="text-xs text-on-surface-variant font-label-mono">
                {anomalyCount > 0
                  ? `${anomalyCount} active anomaly${anomalyCount > 1 ? "ies" : "y"}`
                  : "No anomalies detected"}
              </p>
            </div>
            <div className="relative flex-grow min-h-[280px] p-6 flex flex-col gap-3">
              {/* Status indicators */}
              <div className="flex items-center justify-between p-3 glass-card border border-glass">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${hasAnomaly ? "bg-status-error animate-pulse" : "bg-status-success"}`}
                  ></span>
                  <span className="text-sm text-white font-medium">AI Spend Monitor</span>
                </div>
                <span className="text-[10px] font-label-mono text-on-surface-variant">
                  {hasAnomaly ? "THRESHOLD EXCEEDED" : "NOMINAL"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 glass-card border border-glass">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${(overview?.todayErrors ?? 0) > 0 ? "bg-status-error animate-pulse" : "bg-status-success"}`}
                  ></span>
                  <span className="text-sm text-white font-medium">Error Rate</span>
                </div>
                <span className="text-[10px] font-label-mono text-on-surface-variant">
                  {(overview?.todayErrors ?? 0) > 0 ? `${overview?.todayErrors} TODAY` : "NOMINAL"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 glass-card border border-glass">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-status-success" : "bg-status-warning"}`}
                  ></span>
                  <span className="text-sm text-white font-medium">Live Feed</span>
                </div>
                <span className="text-[10px] font-label-mono text-on-surface-variant">
                  {connected ? "CONNECTED" : "POLLING MODE"}
                </span>
              </div>

              {/* Incident Overlay Box */}
              <div className="mt-auto p-4 glass-card bg-surface/90 border border-glass">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-label-mono text-on-surface-variant">
                    Active Incident
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${
                      hasAnomaly
                        ? "bg-status-error/20 text-status-error"
                        : "bg-status-success/20 text-status-success"
                    }`}
                  >
                    {hasAnomaly ? "Critical" : "Nominal"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-white">
                  {hasAnomaly
                    ? `${anomalyCount} anomaly${anomalyCount > 1 ? "ies" : "y"} detected in your environment`
                    : "All systems operating normally"}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {hasAnomaly
                    ? "Review the Agent Drift page for details"
                    : "Automatic threat shield active"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Stream */}
        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-headline-md text-headline-md text-white font-bold">
              Live Agent Activity Stream
            </h3>
            <span className="font-label-mono text-[10px] text-on-surface-variant flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full pulse-emerald"></span>
              REAL-TIME FEED
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
            {displayLogs.length === 0 ? (
              <div className="glass-card px-6 py-12 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl mb-3">
                  sensors
                </span>
                <p className="font-semibold text-white">No activity yet</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                  Activity will appear here once you run scans or the SDK streams AI telemetry.
                </p>
                <Link
                  href="/scanning"
                  className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 transition-all"
                >
                  Start Scanning
                </Link>
              </div>
            ) : (
              displayLogs.map((log, idx) => (
                <div
                  key={log.id}
                  className="glass-card px-6 py-4 flex items-center justify-between stream-fade-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded border border-glass bg-surface-container flex items-center justify-center">
                      <span
                        className={`material-symbols-outlined text-sm ${log.anomaly ? "text-status-error" : log.status === "error" ? "text-status-error" : "text-primary"}`}
                      >
                        {log.anomaly || log.status === "error" ? "warning" : "robot_2"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {(log.agent || "unknown").toUpperCase()}{" "}
                        <span className="text-on-surface-variant font-normal">
                          {log.anomaly || log.status === "error"
                            ? "triggered cost threshold anomaly on"
                            : "processed request using"}
                        </span>{" "}
                        {log.model || "unknown model"}
                      </p>
                      <p className="text-[10px] font-label-mono text-on-surface-variant">
                        Cost: ${log.cost.toFixed(4)} • {log.time}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] font-bold rounded uppercase ${
                      log.anomaly || log.status === "error"
                        ? "bg-status-error/10 text-status-error border border-status-error/20"
                        : "bg-status-success/10 text-status-success border border-status-success/20"
                    }`}
                  >
                    {log.anomaly || log.status === "error" ? "Flagged" : "Success"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 md:left-64 right-0 h-10 bg-surface-container-lowest/80 backdrop-blur-lg border-t border-glass z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-status-success pulse-emerald" : "bg-status-warning"}`}
          ></span>
          <span className="font-label-mono text-[10px] text-on-surface-variant tracking-wider">
            {connected ? "LIVE FEED: OPERATIONAL" : "LIVE FEED: POLLING MODE"}
          </span>
        </div>
        <span className="font-label-mono text-[10px] text-on-surface-variant tracking-wider">
          RAKSHEX AI SECURITY
        </span>
      </footer>
    </div>
  );
}
