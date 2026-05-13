"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import RiskChart from "../../components/RiskChart";
import { EmptyState } from "../../components/EmptyState";
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

    ws.onmessage = event => {
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
          setLogs(prev => [newLog, ...prev].slice(0, 50));
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

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">
              DevPulse Command Center
            </h1>
            <p className="text-gray-400 mt-1">
              Real-time AI Agent Cost Monitoring & Security
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm text-gray-400">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <PlanUtilizationBanner />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">
              Total LLM Spend
            </h3>
            <p className="text-4xl font-bold mt-2 text-green-400">
              ${totalCost < 0.01 && totalCost > 0 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Lifetime accumulated cost
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">
              Active Agents
            </h3>
            <p className="text-4xl font-bold mt-2 text-blue-400">
              {new Set(logs.map(l => l.agent)).size}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Unique agents this session
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">
              API Calls
            </h3>
            <p className="text-4xl font-bold mt-2 text-purple-400">
              {logs.length}
            </p>
            <p className="text-xs text-gray-500 mt-2">Total API interactions</p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide">
              Anomalies
            </h3>
            <p className="text-4xl font-bold mt-2 text-orange-400">
              {logs.filter(l => l.anomaly).length}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Cost spikes this session
            </p>
          </div>

          {anomalyActive && (
            <div className="sm:col-span-2 lg:col-span-4 bg-red-900/30 p-6 rounded-lg border border-red-500">
              <h3 className="text-red-400 font-bold text-lg">
                Anomaly Detected
              </h3>
              <p className="text-red-200 text-sm">
                Cost spike observed in recent agent activity. Review logs below.
              </p>
            </div>
          )}
        </div>

        <RiskChart data={logs.map(l => l.cost)} />

        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Live Agent Activity</h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <EmptyState
                compact
                icon={<span>📡</span>}
                title="No activity yet"
                description="Wire up the DevPulse SDK in your app to stream live agent traffic here."
              />
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-gray-700/50 p-3 rounded hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-blue-300 font-mono text-sm">
                      {log.agent}
                    </span>
                    {log.model && (
                      <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-600 rounded">
                        {log.model}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">{log.time}</span>
                    <span
                      className={
                        log.anomaly
                          ? "text-red-400 font-bold"
                          : "text-green-400"
                      }
                    >
                      ${log.cost < 0.01 && log.cost > 0 ? log.cost.toFixed(4) : log.cost.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
