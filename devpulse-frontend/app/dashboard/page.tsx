"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import PlanUtilizationBanner from "../../components/PlanUtilizationBanner";

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:8000/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

const WS_URL = getWsUrl();

interface Message {
  type: string;
  total_cost?: number;
  cost?: number;
  agent_id?: string;
  anomaly?: boolean;
  model?: string;
}

interface LogEntry {
  time: string;
  agent: string;
  cost: number;
  anomaly: boolean;
  model?: string;
}

export default function Dashboard() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [anomalyActive, setAnomalyActive] = useState(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);

        if (msg.type === "cost_update") {
          setTotalCost(msg.total_cost || 0);
          const newLog: LogEntry = {
            time: new Date().toLocaleTimeString(),
            agent: msg.agent_id || "unknown",
            cost: msg.cost || 0,
            anomaly: msg.anomaly || false,
            model: msg.model,
          };
          setLogs((prev) => [newLog, ...prev].slice(0, 50));
          if (msg.anomaly) setAnomalyActive(true);
        } else if (msg.type === "init") {
          setTotalCost(msg.total_cost || 0);
        } else if (msg.type === "pong") {
          // heartbeat response
        }
      } catch {
        // Message parse failure
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setSocket(null);
      reconnectRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws.close();
    };
  }, [connect]);

  const activeAgents = new Set(logs.map((l) => l.agent)).size;
  const anomalyCount = logs.filter((l) => l.anomaly).length;

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
            <button className="px-4 py-2 bg-primary text-on-primary font-button-text font-bold rounded-lg emerald-glow hover:opacity-90 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">print</span>
              Generate Report
            </button>
            <button className="px-4 py-2 border border-glass text-on-surface hover:bg-surface-container-low font-button-text font-bold rounded-lg transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">download</span>
              Export Data
            </button>
          </div>
        </div>

        <PlanUtilizationBanner />

        {/* Bento Hero Grid */}
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
              ${totalCost < 0.01 && totalCost > 0 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-status-success font-label-mono text-xs">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>+4.2% vs last session</span>
            </div>
          </div>

          {/* Active AI Nodes */}
          <div
            className="col-span-12 md:col-span-4 glass-card p-6 entrance-anim"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-mono text-[11px] uppercase tracking-wider">
                Active AI Nodes
              </span>
              <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            <div className="flex items-end gap-3">
              <h2 className="font-headline-xl text-headline-xl text-white font-bold">
                {activeAgents || "2,104"}
              </h2>
              <span className="font-body-md text-on-surface-variant pb-2">across 12 clusters</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                  C1
                </div>
                <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                  C2
                </div>
                <div className="w-6 h-6 rounded-full border border-glass bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                  C3
                </div>
              </div>
              <span className="text-xs text-on-surface-variant font-label-mono">
                +9 more active
              </span>
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
              {logs.length > 0 ? (logs.length * 1.2).toFixed(1) : "45.2"}M{" "}
              <span className="text-headline-md text-on-surface-variant">req/s</span>
            </h2>
            <div className="mt-4 w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary w-3/4 shadow-[0_0_8px_#6ee7b7]"></div>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant font-label-mono">
              System Load: 78% Capacity
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
            {/* Synthetic Threat Bars */}
            <div className="flex-grow flex items-end justify-between gap-2 pt-4 min-h-[220px]">
              {[40, 60, 45, 85, 30, 55, 75, 40, 65, 95, 50, 60].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t-sm relative group cursor-pointer h-full"
                >
                  <div
                    style={{ height: `${height}%` }}
                    className="absolute bottom-0 w-full bg-primary rounded-t-sm group-hover:brightness-125 transition-all shadow-[0_0_8px_rgba(110,231,183,0.3)]"
                  ></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-label-mono text-on-surface-variant">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>23:59</span>
            </div>
          </div>

          {/* Right Panel: Cluster Health Map */}
          <div
            className="col-span-12 lg:col-span-4 glass-card flex flex-col entrance-anim overflow-hidden"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="p-6 border-b border-glass">
              <h3 className="font-headline-md text-headline-md text-white font-bold">
                Cluster Health
              </h3>
              <p className="text-xs text-on-surface-variant font-label-mono">Global Node Status</p>
            </div>
            <div
              className="relative flex-grow bg-cover bg-center min-h-[280px]"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop')",
              }}
            >
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"></div>

              {/* Pulsing Nodes on Map */}
              <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-primary rounded-full pulse-dot"></div>
              <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-primary rounded-full pulse-dot"></div>
              <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-status-error rounded-full animate-pulse"></div>
              <div className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-primary rounded-full pulse-dot"></div>

              {/* Incident Overlay Box */}
              <div className="absolute bottom-4 left-4 right-4 p-4 glass-card bg-surface/90 border border-glass">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-label-mono text-on-surface-variant">
                    Active Incident
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${
                      anomalyActive || anomalyCount > 0
                        ? "bg-status-error/20 text-status-error"
                        : "bg-status-success/20 text-status-success"
                    }`}
                  >
                    {anomalyActive || anomalyCount > 0 ? "Critical" : "Nominal"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-white">
                  {anomalyActive || anomalyCount > 0
                    ? "Anomaly in US-East-2 Node Cluster"
                    : "All Node Clusters Operating Normally"}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {anomalyActive || anomalyCount > 0
                    ? "Brute force mitigation active (99.2% filtered)"
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
            {logs.length === 0 ? (
              // Empty State
              <div className="glass-card px-6 py-12 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl mb-3">
                  sensors
                </span>
                <p className="font-semibold text-white">No active telemetry stream detected</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                  Connect the RaksHex SDK to start streaming live AI node metrics to this dashboard.
                </p>
              </div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className="glass-card px-6 py-4 flex items-center justify-between stream-fade-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded border border-glass bg-surface-container flex items-center justify-center">
                      <span
                        className={`material-symbols-outlined text-sm ${log.anomaly ? "text-status-error" : "text-primary"}`}
                      >
                        {log.anomaly ? "warning" : "robot_2"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {log.agent.toUpperCase()}{" "}
                        <span className="text-on-surface-variant font-normal">
                          {log.anomaly
                            ? "triggered cost threshold anomaly on"
                            : "processed request using"}
                        </span>{" "}
                        {log.model || "unknown model"}
                      </p>
                      <p className="text-[10px] font-label-mono text-on-surface-variant">
                        Request Cost: ${log.cost.toFixed(4)} • {log.time}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] font-bold rounded uppercase ${
                      log.anomaly
                        ? "bg-status-error/10 text-status-error border border-status-error/20"
                        : "bg-status-success/10 text-status-success border border-status-success/20"
                    }`}
                  >
                    {log.anomaly ? "Flagged" : "Success"}
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
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-status-success pulse-emerald" : "bg-status-error"}`}
          ></span>
          <span className="font-label-mono text-[10px] text-on-surface-variant tracking-wider">
            {connected ? "API SERVICE: OPERATIONAL" : "API SERVICE: DISCONNECTED"}
          </span>
        </div>
        <span className="font-label-mono text-[10px] text-on-surface-variant tracking-wider">
          RaksHex AI SECURITY CORE • VERSION 2.1.4
        </span>
      </footer>
    </div>
  );
}
