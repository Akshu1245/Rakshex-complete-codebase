"use client";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

type ScanType = "full" | "quick" | "shadow_api" | "prompt_injection";
type ScanIntensity = "passive" | "active" | "brute";
type TargetEnv = "production" | "staging";

interface TerminalLog {
  time: string;
  type: "info" | "success" | "warn" | "error";
  msg: string;
}

export default function ScanningPage() {
  const [selectedCollection, setSelectedCollection] = useState("");
  const [scanType, setScanType] = useState<ScanType>("full");
  const [scanIntensity, setScanIntensity] = useState<ScanIntensity>("active");
  const [targetEnv, setTargetEnv] = useState<TargetEnv>("production");
  const [rateLimit, setRateLimit] = useState(250);

  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    riskScore: number;
    riskLevel: string;
    findings: Array<{
      id: string;
      title: string;
      description: string | null;
      severity: string;
      category: string | null;
      remediation: string | null;
      cweId: string | null;
    }>;
  } | null>(null);

  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [queuedScanId, setQueuedScanId] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const startScan = trpc.scanning.startScan.useMutation({
    onSuccess: (data) => {
      setScanStatus(data.status);
      if (data.status === "queued" && data.scanId) {
        setQueuedScanId(data.scanId);
      }
      addTerminalLog(
        "success",
        `Scan request submitted successfully. Job ID: ${data.scanId || "N/A"}`,
      );
    },
    onError: (err: { message: string }) => {
      setError(err.message);
      addTerminalLog("error", `Scan submission failed: ${err.message}`);
    },
  });

  const addTerminalLog = (type: TerminalLog["type"], msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, { time: timestamp, type, msg }]);
  };

  // Seed default terminal logs on mount
  useEffect(() => {
    setTerminalLogs([
      {
        time: new Date().toLocaleTimeString(),
        type: "info",
        msg: "Initializing RaksHex Scanner Core...",
      },
      {
        time: new Date().toLocaleTimeString(),
        type: "info",
        msg: "Target: https://api.rakshex-cloud.net",
      },
      {
        time: new Date().toLocaleTimeString(),
        type: "success",
        msg: "Handshake successful. TLS 1.3 detected.",
      },
      {
        time: new Date().toLocaleTimeString(),
        type: "info",
        msg: "Crawling API directory structure...",
      },
      {
        time: new Date().toLocaleTimeString(),
        type: "warn",
        msg: "Found 12 exposed endpoints in root directory.",
      },
    ]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Terminal simulated log streaming when scanning
  useEffect(() => {
    if (startScan.isPending) {
      addTerminalLog("info", `Initiating ${scanIntensity} scan on collection...`);
      addTerminalLog("info", `Rate limit capped at ${rateLimit} requests/second.`);
      const interval = setInterval(() => {
        const simulatedMsgs = [
          { type: "info" as const, msg: "Fuzzing authorization header tokens..." },
          { type: "warn" as const, msg: "Detected possible CORS policy wildcard origin access." },
          {
            type: "info" as const,
            msg: "Scanning input parameter values for SQL injection vectors...",
          },
          {
            type: "error" as const,
            msg: "CRITICAL: SQL syntax leakage detected on /v1/auth/login",
          },
          { type: "success" as const, msg: "Autofix patch prepared for SQLi vulnerability." },
        ];
        const randomMsg = simulatedMsgs[Math.floor(Math.random() * simulatedMsgs.length)];
        addTerminalLog(randomMsg.type, randomMsg.msg);
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [startScan.isPending, scanIntensity, rateLimit]);

  const handleScan = () => {
    if (!selectedCollection) return;
    setError(null);
    setScanResult(null);
    setScanStatus(null);
    setQueuedScanId(null);

    addTerminalLog(
      "info",
      `Preparing to trigger scan for collection: ${collections.find((c) => c.id === selectedCollection)?.name}`,
    );
    startScan.mutate({ collectionId: selectedCollection, scanType });
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toLowerCase();
    addTerminalLog("info", `sh-3$ ${terminalInput}`);
    setTerminalInput("");

    setTimeout(() => {
      if (cmd === "clear") {
        setTerminalLogs([]);
      } else if (cmd === "help") {
        addTerminalLog("info", "Available commands: clear, help, scan, status, version, patch");
      } else if (cmd === "scan") {
        handleScan();
      } else if (cmd === "version") {
        addTerminalLog("success", "RaksHex Security Scan Core v2.1.4-beta");
      } else if (cmd === "status") {
        addTerminalLog(
          "info",
          `Target Env: ${targetEnv.toUpperCase()} | Intensity: ${scanIntensity.toUpperCase()} | Rate Limit: ${rateLimit} REQ/S`,
        );
      } else if (cmd === "patch") {
        addTerminalLog("success", "Patch committed. Build pipeline triggered.");
      } else {
        addTerminalLog("error", `Command not found: '${cmd}'. Type 'help' for options.`);
      }
    }, 300);
  };

  const severityColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "critical":
        return "text-status-error bg-status-error/10 border-status-error/30";
      case "high":
        return "text-status-error bg-status-error/5 border-status-error/20";
      case "medium":
        return "text-tertiary bg-tertiary/5 border-tertiary/20";
      case "low":
        return "text-secondary bg-secondary/5 border-secondary/20";
      default:
        return "text-on-surface-variant bg-surface-container border-glass";
    }
  };

  const [patchCommitted, setPatchCommitted] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-surface-base text-on-surface overflow-hidden relative font-body-md">
      <div className="scan-line pointer-events-none"></div>

      <div className="flex-grow flex overflow-hidden">
        {/* Left Panel: Scan Configuration */}
        <aside className="w-80 border-r border-glass p-6 overflow-y-auto space-y-8 flex flex-shrink-0 flex-col bg-surface/30">
          <section>
            <h3 className="font-label-mono text-label-mono text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">target</span>
              TARGET ENVIRONMENT
            </h3>
            <div className="space-y-3">
              <label
                className={`block p-4 rounded-lg glass-panel cursor-pointer hover:bg-surface-container-low transition-all border ${
                  targetEnv === "production" ? "border-primary/40 bg-primary/5" : "border-glass"
                }`}
                onClick={() => setTargetEnv("production")}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div
                      className={`font-semibold ${targetEnv === "production" ? "text-primary" : "text-white"}`}
                    >
                      Production API
                    </div>
                    <div className="text-[12px] text-on-surface-variant">api.RaksHex-cloud.net</div>
                  </div>
                  <span
                    className={`material-symbols-outlined ${targetEnv === "production" ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {targetEnv === "production" ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </div>
              </label>

              <label
                className={`block p-4 rounded-lg glass-panel cursor-pointer hover:bg-surface-container-low transition-all border ${
                  targetEnv === "staging" ? "border-primary/40 bg-primary/5" : "border-glass"
                }`}
                onClick={() => setTargetEnv("staging")}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div
                      className={`font-semibold ${targetEnv === "staging" ? "text-primary" : "text-white"}`}
                    >
                      Staging Node
                    </div>
                    <div className="text-[12px] text-on-surface-variant">
                      stg-us-east.RaksHex.dev
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined ${targetEnv === "staging" ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {targetEnv === "staging" ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section>
            <h3 className="font-label-mono text-label-mono text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              SCAN INTENSITY
            </h3>
            <div className="flex flex-col gap-2 p-1 bg-surface-container rounded-lg border border-glass">
              <button
                onClick={() => setScanIntensity("passive")}
                className={`text-left px-4 py-3 rounded-md transition-all font-semibold ${
                  scanIntensity === "passive"
                    ? "bg-primary text-on-primary font-semibold emerald-glow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Passive
              </button>
              <button
                onClick={() => setScanIntensity("active")}
                className={`text-left px-4 py-3 rounded-md transition-all font-semibold ${
                  scanIntensity === "active"
                    ? "bg-primary text-on-primary font-semibold emerald-glow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setScanIntensity("brute")}
                className={`text-left px-4 py-3 rounded-md transition-all font-semibold ${
                  scanIntensity === "brute"
                    ? "bg-primary text-on-primary font-semibold emerald-glow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Brute
              </button>
            </div>
            <p className="mt-4 text-[12px] text-on-surface-variant italic">
              Active mode includes heuristic vulnerability probing and payload injection
              simulations.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="font-label-mono text-label-mono text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">speed</span>
              RATE LIMITING
            </h3>
            <input
              className="w-full accent-primary bg-surface-container-high rounded-full h-1.5 cursor-pointer"
              type="range"
              min="10"
              max="500"
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
            />
            <div className="flex justify-between font-label-mono text-[10px] text-on-surface-variant">
              <span>10 REQ/S</span>
              <span className="text-primary font-bold">{rateLimit} REQ/S</span>
              <span>500 REQ/S</span>
            </div>
          </section>

          <section className="border-t border-glass pt-6 space-y-4">
            <h3 className="font-label-mono text-label-mono text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              RUN VERCEL SCAN
            </h3>

            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-glass focus:ring-1 focus:ring-primary focus:outline-none text-sm text-white"
            >
              <option value="">-- Select a collection --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>

            <label htmlFor="scan-type" className="sr-only">
              Scan Type
            </label>
            <select
              id="scan-type"
              value={scanType}
              onChange={(e) => setScanType(e.target.value as ScanType)}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-glass focus:ring-1 focus:ring-primary focus:outline-none text-sm text-white"
            >
              <option value="full">Full (all checks)</option>
              <option value="quick">Quick</option>
              <option value="shadow_api">Shadow APIs</option>
              <option value="prompt_injection">Prompt injection</option>
            </select>

            <button
              onClick={handleScan}
              disabled={startScan.isPending || !selectedCollection}
              className="w-full py-3 bg-primary text-on-primary font-button-text font-bold rounded-lg emerald-glow hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">search</span>
              {startScan.isPending ? "SCANNING..." : "TRIGGER SCAN"}
            </button>
          </section>
        </aside>

        {/* Center Panel: Finding Details */}
        <section className="flex-1 p-8 overflow-y-auto bg-surface-container-lowest/30 flex flex-col justify-between">
          <div className="max-w-4xl mx-auto w-full space-y-8">
            {error && (
              <div className="p-4 bg-status-error/10 border border-status-error/40 text-status-error rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined">warning</span>
                <span className="text-sm font-semibold">{error}</span>
              </div>
            )}

            {/* If a real scan was completed, show those results */}
            {scanResult ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-status-error/10 text-status-error border border-status-error/30 rounded font-label-mono text-[12px] uppercase">
                      Risk Level: {scanResult.riskLevel}
                    </span>
                    <h2 className="font-headline-md text-headline-md text-primary font-bold">
                      Scan Summary ({scanResult.findings.length} Findings)
                    </h2>
                  </div>
                  <div className="text-2xl font-bold font-label-mono">
                    Score: <span className="text-primary">{scanResult.riskScore}/100</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {scanResult.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`glass-panel rounded-xl overflow-hidden border p-5 ${severityColor(f.severity)}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-white text-base">{f.title}</span>
                        <span className="text-xs uppercase font-label-mono px-2 py-0.5 rounded border border-current">
                          {f.severity}
                        </span>
                      </div>
                      {f.description && (
                        <p className="text-sm text-on-surface-variant mb-4">{f.description}</p>
                      )}
                      {f.remediation && (
                        <div className="bg-black/30 p-4 rounded border border-glass font-code text-xs">
                          <span className="text-status-success font-semibold">Remediation:</span>{" "}
                          {f.remediation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Default/Sandbox Mock Page (SQLi Vulnerability)
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-status-error/10 text-status-error border border-status-error/30 rounded font-label-mono text-[12px]">
                      CRITICAL
                    </span>
                    <h2 className="font-headline-md text-headline-md text-primary font-bold">
                      SQL Injection Vulnerability
                    </h2>
                  </div>
                  <button className="text-primary hover:underline font-label-mono text-sm">
                    EXPAND TRACE
                  </button>
                </div>

                {/* Trace Card */}
                <div className="glass-panel rounded-xl overflow-hidden border border-status-error/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <div className="px-6 py-4 border-b border-glass bg-surface-container/30 flex justify-between items-center">
                    <span className="font-label-mono text-label-mono text-primary uppercase">
                      Vulnerable Trace: API Endpoint /v1/auth/login
                    </span>
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      verified_user
                    </span>
                  </div>
                  <div className="p-6 font-code text-[13px] bg-black/40 leading-relaxed text-on-surface-variant">
                    <div className="flex gap-4">
                      <span className="text-on-surface-variant/30 select-none">122</span>
                      <div>
                        <span className="text-secondary">const</span> {"{ username, password }"} =
                        req.body;
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-on-surface-variant/30 select-none">123</span>
                      <div>
                        <span className="text-secondary">const</span> query ={" "}
                        <span className="text-primary-container">
                          `SELECT * FROM users WHERE username = '${"{"}username{"}"}' AND password =
                          '${"{"}password{"}"}'`
                        </span>
                        ;
                      </div>
                    </div>
                    <div className="flex gap-4 bg-status-error/10 -mx-6 px-6 border-l-4 border-status-error">
                      <span className="text-status-error/50 select-none">124</span>
                      <div>
                        <span className="text-on-surface">db.execute(query);</span>{" "}
                        <span className="text-status-error ml-4 font-body-md">
                          ⚠️ INJECTION POINT DETECTED
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 p-4 rounded bg-surface-container border border-status-error/20">
                      <div className="text-status-error font-semibold mb-1">Detected Payload:</div>
                      <code className="text-primary-container">' OR '1'='1</code>
                    </div>
                  </div>
                </div>

                {/* Remediation Block */}
                <div className="glass-panel rounded-xl overflow-hidden border border-glass">
                  <div className="px-6 py-4 border-b border-glass bg-surface-container/30 flex justify-between items-center">
                    <span className="font-label-mono text-label-mono text-status-success uppercase">
                      Proposed Patch (Parameterized Query)
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          'const query = "SELECT * FROM users WHERE username = ? AND password = ?";\ndb.execute(query, [username, password]);',
                        );
                        addTerminalLog("info", "Remediation code snippet copied to clipboard.");
                      }}
                      className="flex items-center gap-2 text-primary font-label-mono text-[12px] hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      COPY SNIPPET
                    </button>
                  </div>
                  <div className="p-6 font-code text-[13px] bg-surface-container-lowest leading-relaxed text-on-surface-variant">
                    <div className="flex gap-4">
                      <span className="text-on-surface-variant/30 select-none">123</span>
                      <div>
                        <span className="text-secondary">const</span> query ={" "}
                        <span className="text-status-success">
                          "SELECT * FROM users WHERE username = ? AND password = ?"
                        </span>
                        ;
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-on-surface-variant/30 select-none">124</span>
                      <div>
                        <span className="text-on-surface">
                          db.execute(query, [username, password]);
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => {
                        setPatchCommitted(true);
                        addTerminalLog(
                          "success",
                          "Auto-patch committed to staging. Triggering automated regression tests...",
                        );
                      }}
                      disabled={patchCommitted}
                      className={`w-full py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-3 ${
                        patchCommitted
                          ? "bg-status-success/20 border border-status-success/50 text-status-success"
                          : "bg-status-success/10 border border-status-success/40 text-status-success hover:bg-status-success/20"
                      }`}
                    >
                      <span className="material-symbols-outlined">auto_fix_high</span>
                      {patchCommitted
                        ? "PATCH COMMITTED SUCCESSFULLY"
                        : "COMMIT AUTO-PATCH TO STAGING"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Live Terminal */}
        <aside className="w-96 border-l border-glass flex flex-col bg-black flex-shrink-0">
          <div className="p-4 border-b border-glass flex items-center justify-between bg-surface-container-lowest/50">
            <span className="font-label-mono text-[11px] text-primary">
              LIVE SCAN TERMINAL [SH-3]
            </span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-status-success pulse-emerald"></div>
              <div className="w-2 h-2 rounded-full bg-status-success/20"></div>
              <div className="w-2 h-2 rounded-full bg-status-success/20"></div>
            </div>
          </div>

          {/* Scrollable logs */}
          <div className="flex-1 overflow-y-auto p-4 font-code text-[12px] space-y-2 scroll-smooth select-text">
            {terminalLogs.map((log, i) => {
              let colorClass = "text-on-surface-variant";
              let prefix = "[INFO]";
              if (log.type === "success") {
                colorClass = "text-primary";
                prefix = "[OKAY]";
              }
              if (log.type === "warn") {
                colorClass = "text-tertiary";
                prefix = "[WARN]";
              }
              if (log.type === "error") {
                colorClass = "text-status-error font-bold";
                prefix = "[FAIL]";
              }

              return (
                <div key={i} className="flex gap-3 stream-fade-in align-top">
                  <span className="text-on-surface-variant/30 select-none">{log.time}</span>
                  <span className={colorClass}>
                    {prefix} {log.msg}
                  </span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Input */}
          <form
            onSubmit={handleTerminalSubmit}
            className="p-4 bg-surface-container/50 border-t border-glass"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">terminal</span>
              <input
                className="bg-transparent border-none outline-none text-primary font-code text-xs w-full focus:ring-0"
                placeholder="Enter security command (help)..."
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
              />
            </div>
          </form>
        </aside>
      </div>

      {/* Bottom panel: Patch Queue */}
      <footer className="h-24 border-t border-glass bg-surface/90 backdrop-blur-xl flex items-center px-6 gap-8 flex-shrink-0">
        <div className="flex-shrink-0">
          <div className="font-label-mono text-[10px] text-on-surface-variant mb-1">
            PATCH QUEUE
          </div>
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-primary font-bold">04</span>
            <span className="text-on-surface-variant text-sm">Pending</span>
          </div>
        </div>
        <div className="h-10 w-px bg-glass"></div>
        <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar">
          {/* Queue Items */}
          <div className="min-w-[280px] p-3 rounded-lg border border-glass bg-surface-container-low flex items-center gap-4 hover:border-primary/40 transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded bg-status-error/10 flex items-center justify-center text-status-error">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">CORS Policy Misconfig</div>
              <div className="text-[11px] text-on-surface-variant truncate">
                Origin: * detected in /v2/data
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-sm">
              arrow_forward_ios
            </span>
          </div>

          <div className="min-w-[280px] p-3 rounded-lg border border-glass bg-surface-container-low flex items-center gap-4 hover:border-primary/40 transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded bg-status-error/10 flex items-center justify-center text-status-error">
              <span className="material-symbols-outlined">link_off</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">Broken Auth Token</div>
              <div className="text-[11px] text-on-surface-variant truncate">
                Weak JWT secret detected
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-sm">
              arrow_forward_ios
            </span>
          </div>

          <div className="min-w-[280px] p-3 rounded-lg border border-glass bg-surface-container-low flex items-center gap-4 hover:border-primary/40 transition-all cursor-pointer group opacity-50">
            <div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center">
              <span className="material-symbols-outlined">history</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white font-medium">XSS Fixed</div>
              <div className="text-[11px] text-on-surface-variant truncate">
                Successfully patched 2m ago
              </div>
            </div>
          </div>
        </div>
        <button className="flex-shrink-0 px-6 py-2 border border-primary text-primary font-bold rounded-lg hover:bg-primary/10 transition-all font-button-text">
          VIEW ALL ISSUES
        </button>
      </footer>
    </div>
  );
}
