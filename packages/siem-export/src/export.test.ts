import { describe, expect, it } from "vitest";
import { exportSiemEvents } from "./export.js";
import type { SecurityEventRecord } from "./types.js";

const events: SecurityEventRecord[] = [
  {
    id: "evt_1",
    timestamp: "2026-01-01T12:00:00.000Z",
    workspaceId: "ws_a",
    actor: "user_1",
    action: "kill_switch.activated",
    severity: "critical",
    source: "rakshex.gateway",
    message: "Kill switch activated for workspace",
    fields: { reason: "cost_anomaly" },
  },
];

describe("exportSiemEvents", () => {
  it("exports ndjson", () => {
    const out = exportSiemEvents(events, "ndjson");
    expect(out.recordCount).toBe(1);
    expect(JSON.parse(out.body).action).toBe("kill_switch.activated");
  });

  it("exports cef", () => {
    const out = exportSiemEvents(events, "cef");
    expect(out.body.startsWith("CEF:0|Rakshex|")).toBe(true);
    expect(out.body).toContain("kill_switch.activated");
  });

  it("exports syslog", () => {
    const out = exportSiemEvents(events, "syslog");
    expect(out.body).toContain('workspaceId="ws_a"');
  });

  it("exports splunk hec", () => {
    const out = exportSiemEvents(events, "splunk_hec");
    const parsed = JSON.parse(out.body);
    expect(parsed.sourcetype).toBe("rakshex:security");
    expect(parsed.event.workspaceId).toBe("ws_a");
  });
});
