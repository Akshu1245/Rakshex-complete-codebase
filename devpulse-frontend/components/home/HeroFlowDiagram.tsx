import { AgentCard } from "./AgentCard";

function ConnectorVertical() {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "140px", // bottom edge of Cursor card
        transform: "translateX(-50%)",
        width: "2px",
        height: "76px", // 80px gap - 4px buffer
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 1, // behind the cards
      }}
    >
      {/* Static dashed line */}
      <div
        style={{
          width: "2px",
          height: "100%",
          background:
            "repeating-linear-gradient(to bottom, #00d4aa 0px, #00d4aa 6px, transparent 6px, transparent 12px)",
        }}
      />
      {/* Animated traveling dot */}
      <div className="traveling-dot" />
    </div>
  );
}

function ConnectorHorizontal() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "relative",
        width: "50px",
        marginTop: "55px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "2px",
          background:
            "repeating-linear-gradient(to right, #00d4aa 0px, #00d4aa 4px, transparent 4px, transparent 9px)",
        }}
      />
      <div className="traveling-dot-h" />
    </div>
  );
}

export function HeroFlowDiagram() {
  return (
    <div className="hero-diagram">
      {/* CARD 1 — Agent — top area */}
      <AgentCard />

      {/* CONNECTOR: Agent → RakshEx (solid arrow line going DOWN) */}
      <ConnectorVertical />

      {/* BOTTOM ROW: RakshEx card + Application card */}
      <div className="diagram-bottom-row">
        {/* CARD 2 — RakshEx (main card, cyan border) */}
        <div className="diagram-card card-main">
          <div className="card-header">
            {/* Shield icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="card-title">RakshEx</span>
          </div>
          <div className="card-rows">
            <div className="card-row">
              <span className="row-icon">🔒</span>
              <span className="row-label">Endpoints Scanned</span>
              <span className="row-value green">23</span>
            </div>
            <div className="card-row">
              <span className="row-icon">⚠️</span>
              <span className="row-label">Credentials Detected</span>
              <span className="row-value yellow">2</span>
            </div>
            <div className="card-row">
              <span className="row-icon">💰</span>
              <span className="row-label">Cost Anomaly Flagged</span>
              <span className="row-value red">$47.3</span>
            </div>
            <div className="card-row">
              <span className="row-icon">🛡️</span>
              <span className="row-label">Prompt Injection Blocked</span>
              <span className="row-value green">1</span>
            </div>
          </div>
        </div>

        {/* CONNECTOR: RakshEx → Application (dotted horizontal line) */}
        <ConnectorHorizontal />

        {/* CARD 3 — Security Report (Application card) */}
        <div className="diagram-card card-report">
          <div className="card-header">
            {/* Monitor icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span className="card-title">Security Report</span>
          </div>

          {/* Skeleton bar lines */}
          <div className="skeleton-bars">
            <div className="skel-bar" style={{ width: "100%", opacity: 0.2 }} />
            <div className="skel-bar" style={{ width: "70%", opacity: 0.15 }} />
          </div>

          {/* Mini bar chart */}
          <div className="mini-chart">
            <div className="chart-bar" style={{ height: "40px", background: "#00d4aa" }} />
            <div className="chart-bar" style={{ height: "28px", background: "#f59e0b" }} />
            <div className="chart-bar" style={{ height: "20px", background: "#ef4444" }} />
          </div>

          <div className="score-label">SECURITY SCORE</div>
          <div className="score-value">94/100</div>
        </div>
      </div>
    </div>
  );
}
