import { ImageResponse } from "next/og";

export const alt = "RaksHex — AI Action Control Plane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
      <div
        style={{
          position: "absolute",
          width: 460,
          height: 460,
          right: -120,
          top: -165,
          borderRadius: 230,
          background: "rgba(20,184,166,0.10)",
          border: "1px solid rgba(20,184,166,0.18)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
        <div
          style={{
            width: 58,
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #14B8A6",
            borderRadius: 15,
            background: "#07110F",
            color: "#E9FFFC",
            fontSize: 27,
            fontWeight: 800,
          }}
        >
          R
        </div>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 34, fontWeight: 800, letterSpacing: -1.5 }}>
          <span>Raks</span>
          <span style={{ color: "#14B8A6" }}>Hex</span>
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: 12,
            border: "1px solid rgba(20,184,166,0.32)",
            borderRadius: 999,
            padding: "8px 14px",
            color: "#8FE3D8",
            fontSize: 16,
          }}
        >
          PRIVATE BETA
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 68,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: -3.5,
            maxWidth: 940,
          }}
        >
          <span>AI agents don&apos;t just generate.</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ color: "#14B8A6" }}>They act.</span>
            <span>Control what happens next.</span>
          </span>
        </div>
        <div style={{ display: "flex", color: "#A7ADB7", fontSize: 25, lineHeight: 1.4, maxWidth: 940 }}>
          Pre-execution authorization · delegated authority · credential mediation · tamper-evident Action Ledger
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", gap: 24, color: "#8B939F", fontSize: 17 }}>
          <span>Agent Firewall</span>
          <span>Credential Broker</span>
          <span>Action Ledger</span>
        </div>
        <div style={{ display: "flex", color: "#14B8A6", fontSize: 20, fontWeight: 700 }}>rakshex.in</div>
      </div>
    </div>,
    size,
  );
}
