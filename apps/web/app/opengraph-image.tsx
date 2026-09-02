import { ImageResponse } from "next/og";

export const alt = "RaksHex — AI Action Control Plane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const body = "M68 50 L57 62 L48 81 L47 106 L53 124 L58 132 L180 255 L62 374 L57 382 L50 403 L50 421 L55 438 L63 452 L73 462 L82 468 L102 475 L126 476 L146 471 L165 461 L274 380 L293 368 L398 474 L450 474 L345 368 L341 362 L465 236 L415 236 L323 331 L315 337 L147 168 L89 112 L84 101 L84 93 L88 84 L96 77 L105 74 L306 74 L323 79 L336 87 L345 96 L354 111 L358 125 L358 144 L354 159 L345 175 L284 240 L309 265 L375 197 L386 181 L392 168 L398 142 L397 117 L389 91 L375 69 L363 57 L345 45 L327 38 L310 35 L104 35 L87 39 Z M266 341 L259 348 L146 431 L137 436 L127 439 L104 438 L95 433 L87 423 L85 409 L88 398 L92 392 L205 279 Z";
const dot = "M258 139 L247 147 L243 157 L244 166 L252 177 L259 180 L270 180 L279 175 L283 170 L285 165 L285 154 L277 142 L265 138 Z";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#070A0F",
        color: "white",
        padding: "64px 72px",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", width: 460, height: 460, right: -120, top: -165, borderRadius: 230, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
        <div style={{ width: 62, height: 62, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 512 512" width="58" height="58">
            <path d={body} fill="#FFFFFF" fillRule="evenodd" />
            <path d={dot} fill="#FFFFFF" />
          </svg>
        </div>
        <div style={{ display: "flex", marginLeft: 10, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, padding: "8px 14px", color: "#D7DCE3", fontSize: 16 }}>PRIVATE BETA</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 68, lineHeight: 1.02, fontWeight: 800, letterSpacing: -3.5, maxWidth: 940 }}>
          <span>AI agents don&apos;t just generate.</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ color: "#FFFFFF" }}>They act.</span>
            <span>Control what happens next.</span>
          </span>
        </div>
        <div style={{ display: "flex", color: "#A7ADB7", fontSize: 25, lineHeight: 1.4, maxWidth: 940 }}>
          Pre-execution authorization · delegated authority · credential mediation · tamper-evident Action Ledger
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", gap: 24, color: "#8B939F", fontSize: 17 }}><span>Agent Firewall</span><span>Credential Broker</span><span>Action Ledger</span></div>
        <div style={{ display: "flex", color: "#FFFFFF", fontSize: 20, fontWeight: 700 }}>rakshex.in</div>
      </div>
    </div>,
    size,
  );
}
