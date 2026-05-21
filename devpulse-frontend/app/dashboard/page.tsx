"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import RiskChart from "../../components/RiskChart";
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
        // Message parse failure — silently skip malformed data
      }
    };

    ws.onerror = () => {
      // WebSocket errors surface through onclose — handled by reconnect logic
    };

    ws.onclose = () => {
      setConnected(false);
      setSocket(null);
      // Auto-reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    // Heartbeat every 30s
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
    <div className="p-8 min-h-screen bg-background text-on-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1
              className="font-display-lg text-on-surface"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              System Overview
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border-l border-primary">
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-primary status-pulse" : "bg-error"}`}
                ></span>
                <span
                  className="text-primary"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                  }}
                >
                  {connected ? "Live Monitoring Active" : "Disconnected"}
                </span>
              </span>
              <span
                className="text-on-surface-variant"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
              >
                Real-time AI cost &amp; security feed
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-primary text-on-primary font-bold transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              Generate Report
            </button>
            <button
              className="px-4 py-2 border border-outline-variant text-on-surface font-bold hover:bg-surface-variant transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              Export Data
            </button>
          </div>
        </div>

        <PlanUtilizationBanner />

        {/* Anomaly Alert Banner */}
        {anomalyActive && (
          <div className="mb-6 p-4 bg-error/10 border-l-4 border-error glass-card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-error pulse-active"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div>
                <h4
                  className="text-error font-bold"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                  }}
                >
                  ANOMALY DETECTED — COST SPIKE
                </h4>
                <p
                  className="text-on-error-container"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  Abnormal cost spike observed in recent agent activity. Review logs below.
                </p>
              </div>
            </div>
            <button
              className="px-6 py-2 bg-error text-on-error font-bold uppercase"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              INVESTIGATE
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-12 gap-gutter mb-6">
          {/* Total Spend */}
          <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-xl relative overflow-hidden">
            <div className="scan-line"></div>
            <p
              className="font-label-caps text-on-surface-variant mb-4 flex items-center gap-2"
              style={{ fontSize: "11px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                monetization_on
              </span>
              Total Real-time Spend
            </p>
            <h2
              className="text-primary"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "40px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              ${totalCost < 0.01 && totalCost > 0 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
            </h2>
            <div className="mt-4 h-10 w-full">
              <RiskChart data={logs.map((l) => l.cost)} />
            </div>
            <p
              className="mt-2 text-on-surface-variant"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
            >
              Lifetime accumulated cost
            </p>
          </div>

          {/* Active Agents */}
          <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-xl">
            <p
              className="font-label-caps text-on-surface-variant mb-4 flex items-center gap-2"
              style={{ fontSize: "11px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                hub
              </span>
              Active AI Nodes
            </p>
            <h2
              className="text-on-surface"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "40px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {activeAgents}
            </h2>
            <p
              className="text-tertiary mt-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
            >
              Unique agents this session
            </p>
          </div>

          {/* Anomalies */}
          <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-xl">
            <p
              className="font-label-caps text-on-surface-variant mb-4 flex items-center gap-2"
              style={{ fontSize: "11px" }}
            >
              <span className="material-symbols-outlined text-error" style={{ fontSize: "16px" }}>
                warning
              </span>
              Anomalies Detected
            </p>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "40px",
                fontWeight: 700,
                lineHeight: 1.1,
                color: anomalyCount > 0 ? "#ffb4ab" : "#e6e0e9",
              }}
            >
              {anomalyCount}
            </h2>
            <p
              className="text-on-surface-variant mt-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
            >
              API calls: {logs.length} total
            </p>
          </div>
        </div>

        {/* Live Activity Table */}
        <div className="glass-card rounded-xl overflow-hidden mb-20">
          <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
            <p
              className="text-on-surface flex items-center gap-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                view_list
              </span>
              LIVE AGENT ACTIVITY STREAM
            </p>
            <div
              className="flex items-center gap-4"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                {activeAgents} Active
              </span>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  {anomalyCount} Anomalies
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table
              className="w-full text-left"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <thead>
                <tr
                  className="text-on-surface-variant border-b border-outline-variant/10"
                  style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                >
                  <th className="px-6 py-4 font-bold">AGENT ID</th>
                  <th className="px-6 py-4 font-bold">MODEL</th>
                  <th className="px-6 py-4 font-bold">STATUS</th>
                  <th className="px-6 py-4 font-bold">COST</th>
                  <th className="px-6 py-4 font-bold text-right">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-on-surface-variant"
                      style={{ fontSize: "13px" }}
                    >
                      <span
                        className="material-symbols-outlined block mx-auto mb-3 text-on-surface-variant/30"
                        style={{ fontSize: "48px" }}
                      >
                        sensors
                      </span>
                      No activity yet — wire up the Rakshex SDK to stream live agent traffic
                    </td>
                  </tr>
                ) : (
                  logs.map((log, i) => (
                    <tr key={i} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-on-surface">
                        {log.agent.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{log.model || "—"}</td>
                      <td className="px-6 py-4">
                        {log.anomaly ? (
                          <span
                            className="px-2 py-0.5 border-l-2 border-error bg-error/10 text-error font-bold"
                            style={{ fontSize: "10px" }}
                          >
                            ANOMALY
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 border-l-2 border-primary bg-primary/10 text-primary font-bold"
                            style={{ fontSize: "10px" }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{ color: log.anomaly ? "#ffb4ab" : "#cfbcff" }}
                      >
                        $
                        {log.cost < 0.01 && log.cost > 0
                          ? log.cost.toFixed(4)
                          : log.cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-on-surface-variant">{log.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-surface-variant/10 text-center border-t border-outline-variant/10">
            <button
              className="text-primary hover:underline"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              VIEW ALL INFRASTRUCTURE LOGS
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="fixed bottom-0 left-0 md:left-64 right-0 h-10 bg-surface-container-lowest/80 backdrop-blur-lg border-t border-outline-variant/10 z-30 px-6 flex items-center justify-between">
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-error"}`}
              ></span>
              <span
                className="text-on-surface-variant"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                }}
              >
                {connected ? "API: OPERATIONAL" : "API: DISCONNECTED"}
              </span>
            </div>
          </div>
          <span
            className="text-on-surface-variant"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
            }}
          >
            RAKSHEX AI — SYSTEM ALPHA-9
          </span>
        </div>
      </div>
    </div>
  );
}
