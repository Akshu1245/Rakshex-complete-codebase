"use client";

import { useEffect, useState } from "react";

interface HealthData {
  status: string;
  db: string;
  redis: string;
  uptime: number;
  timestamp: string;
  version: string;
}

export default function StatusClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = async () => {
    try {
      // Direct call to relative backend health API
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      console.error("Health check fetch failed:", err);
      setError(err?.message || "Failed to fetch service health");
      setHealth(null);
    } finally {
      setLastChecked(new Date());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30 seconds ping
    return () => clearInterval(interval);
  }, []);

  const isApiOk = health && health.status === "ok";
  const isDbOk = health && health.db === "connected";
  const isRedisOk = health && health.redis === "connected";

  // Match Option B requirements: API Status, Auth Service, Scanner Engine
  const services = [
    {
      name: "API Gateway & Engine",
      status: loading ? "checking" : error ? "offline" : isApiOk ? "operational" : "degraded",
      uptime: "Live health",
      desc: "Handles inbound request validation and runtime policy execution.",
    },
    {
      name: "Authentication Service",
      status: loading ? "checking" : error ? "offline" : isRedisOk ? "operational" : "degraded",
      uptime: "Live health",
      desc: "Manages session storage, login sequences, and OAuth tokens.",
    },
    {
      name: "Scanner & Rules Engine",
      status: loading ? "checking" : error ? "offline" : isDbOk ? "operational" : "degraded",
      uptime: "Live health",
      desc: "Runs deterministic security scans on OpenAPI/Postman schemas.",
    },
  ];

  const overallStatus = services.every((s) => s.status === "operational")
    ? "operational"
    : services.some((s) => s.status === "offline" || s.status === "degraded")
      ? "degraded"
      : "checking";

  return (
    <div className="space-y-8">
      {/* Overall Status Banner */}
      <div
        className={`p-6 rounded-xl border flex items-center gap-4 transition-all duration-300 ${
          overallStatus === "operational"
            ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
            : overallStatus === "degraded"
              ? "bg-[#FDB022]/10 border-[#FDB022]/30 text-[#FDB022]"
              : "bg-black/50 border-[#2D3E50] text-[#94A3B8]"
        }`}
      >
        <div className="relative flex h-4 w-4">
          {overallStatus === "operational" && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-4 w-4 ${
              overallStatus === "operational"
                ? "bg-[#10B981]"
                : overallStatus === "degraded"
                  ? "bg-[#FDB022]"
                  : "bg-[#94A3B8]"
            }`}
          ></span>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {overallStatus === "operational"
              ? "All Systems Operational"
              : overallStatus === "degraded"
                ? "Service Degraded"
                : "Connecting to monitor..."}
          </h2>
          <p className="text-sm opacity-80 mt-0.5">
            {overallStatus === "operational"
              ? "All RaksHex backend engines and governance services are running smoothly."
              : overallStatus === "degraded"
                ? "We are experiencing service degradations or connectivity issues. Our engineers are investigating."
                : "Checking system health status..."}
          </p>
        </div>
      </div>

      {/* Services Table/Grid */}
      <div className="bg-black/50 border border-[#2D3E50] rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-transparent border-b border-[#2D3E50] flex items-center justify-between">
          <h3 className="font-bold text-white">System Component Health</h3>
          <span className="text-xs text-slate-400">Pings API health every 30s</span>
        </div>
        <div className="divide-y divide-[#2D3E50]/60">
          {services.map((s) => (
            <div
              key={s.name}
              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#06D6A0]/10 transition-colors"
            >
              <div>
                <h4 className="font-semibold text-white text-base">{s.name}</h4>
                <p className="text-sm text-slate-400 mt-1 max-w-xl">{s.desc}</p>
              </div>
              <div className="flex items-center gap-6 justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.status === "operational"
                        ? "bg-[#10B981]"
                        : s.status === "degraded"
                          ? "bg-[#FDB022]"
                          : s.status === "offline"
                            ? "bg-[#EF4444]"
                            : "bg-[#94A3B8] animate-pulse"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold capitalize ${
                      s.status === "operational"
                        ? "text-[#10B981]"
                        : s.status === "degraded"
                          ? "text-[#FDB022]"
                          : s.status === "offline"
                            ? "text-[#EF4444]"
                            : "text-[#94A3B8]"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="text-right sm:min-w-[80px]">
                  <span className="text-xs text-slate-500 block">Current state</span>
                  <span className="text-sm font-medium text-slate-300">{s.uptime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta Checked Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-transparent/40 p-4 border border-[#2D3E50] rounded-lg">
        <div>
          <span>Last Checked: </span>
          <strong className="text-slate-400">
            {lastChecked ? lastChecked.toLocaleTimeString() : "Never"}
          </strong>
        </div>
        <div>
          <span>API Health Version: </span>
          <code className="text-slate-400 font-mono">{health?.version || "0.4.0"}</code>
        </div>
      </div>
    </div>
  );
}
