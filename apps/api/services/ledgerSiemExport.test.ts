/**
 * Action Ledger -> SIEM mapping tests.
 *
 * The severity mapping is the part worth testing hardest. A SIEM's value is
 * its signal-to-noise ratio: if shadow-mode findings page the on-call at the
 * same severity as real enforced denials, the team learns to ignore the alert
 * and the integration is worse than not having it.
 */
import { describe, expect, it } from "vitest";
import {
  exportLedgerToSiem,
  ledgerRowToSecurityEvent,
  severityFor,
  type LedgerRowForSiem,
} from "./ledgerSiemExport";

const row = (over: Partial<LedgerRowForSiem> = {}): LedgerRowForSiem => ({
  id: "act_1",
  workspaceId: 7,
  agentId: "agt_1",
  principalUserId: 42,
  semanticAction: "financial.refund",
  decision: "ALLOW",
  effectiveDecision: "ALLOW",
  mode: "enforce",
  reasons: ["Action is within delegated authority and policy"],
  resource: "customer:1827",
  environment: "production",
  amountMinor: "100000",
  currency: "INR",
  outcomeStatus: "succeeded",
  recordHash: "abc123",
  occurredAt: new Date("2026-08-06T10:00:00.000Z"),
  ...over,
});

describe("severityFor", () => {
  it("treats an enforced DENY as high — the event a SOC pages on", () => {
    expect(severityFor({ decision: "DENY", effectiveDecision: "DENY", mode: "enforce" })).toBe(
      "high",
    );
  });

  it("treats FREEZE as critical", () => {
    expect(severityFor({ decision: "FREEZE", effectiveDecision: "DENY", mode: "enforce" })).toBe(
      "critical",
    );
  });

  it("DEMOTES shadow-mode findings — nothing was actually blocked", () => {
    // Paging on shadow findings during a rollout trains the team to ignore
    // the alert, which is how a SIEM integration becomes worthless.
    expect(severityFor({ decision: "DENY", effectiveDecision: "ALLOW", mode: "shadow" })).toBe(
      "low",
    );
    expect(severityFor({ decision: "FREEZE", effectiveDecision: "ALLOW", mode: "shadow" })).toBe(
      "low",
    );
  });

  it("keeps ALLOW at info in both modes — audit trail, not an alert", () => {
    expect(severityFor({ decision: "ALLOW", effectiveDecision: "ALLOW", mode: "enforce" })).toBe(
      "info",
    );
    expect(severityFor({ decision: "ALLOW", effectiveDecision: "ALLOW", mode: "shadow" })).toBe(
      "info",
    );
  });

  it("puts approval/limit/pause in the middle", () => {
    for (const d of ["APPROVAL_REQUIRED", "PAUSE", "LIMIT"]) {
      expect(severityFor({ decision: d, effectiveDecision: "DENY", mode: "enforce" })).toBe(
        "medium",
      );
    }
  });
});

describe("ledgerRowToSecurityEvent", () => {
  it("carries the chain hash so the SIEM can verify tamper-evidence", () => {
    // The hash chain is meaningless if it doesn't travel with the event.
    expect(ledgerRowToSecurityEvent(row()).fields?.recordHash).toBe("abc123");
  });

  it("uses the agent as actor, falling back to the principal user", () => {
    expect(ledgerRowToSecurityEvent(row()).actor).toBe("agt_1");
    expect(ledgerRowToSecurityEvent(row({ agentId: null })).actor).toBe("user:42");
  });

  it("marks shadow-mode events in the message so they read unambiguously", () => {
    const ev = ledgerRowToSecurityEvent(row({ decision: "DENY", mode: "shadow" }));
    expect(ev.message).toContain("shadow mode");
    expect(ev.message).toContain("not enforced");
  });

  it("includes the denial reasons", () => {
    const ev = ledgerRowToSecurityEvent(
      row({ decision: "DENY", reasons: ["Amount exceeds delegated limit"] }),
    );
    expect(ev.message).toContain("Amount exceeds delegated limit");
  });

  it("emits an ISO timestamp and survives a bad one", () => {
    expect(ledgerRowToSecurityEvent(row()).timestamp).toBe("2026-08-06T10:00:00.000Z");
    expect(() => ledgerRowToSecurityEvent(row({ occurredAt: null }))).not.toThrow();
    expect(ledgerRowToSecurityEvent(row({ occurredAt: "not-a-date" })).timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it("stringifies workspaceId — SIEM records are string-keyed", () => {
    expect(ledgerRowToSecurityEvent(row()).workspaceId).toBe("7");
  });
});

describe("exportLedgerToSiem", () => {
  const rows = [row(), row({ id: "act_2", decision: "DENY", effectiveDecision: "DENY" })];

  it("emits NDJSON with one parseable record per line", () => {
    const out = exportLedgerToSiem(rows, "ndjson");
    expect(out.contentType).toBe("application/x-ndjson");
    expect(out.recordCount).toBe(2);
    const lines = out.body.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).id).toBe("act_1");
  });

  it("emits CEF that starts with the standard prefix", () => {
    const out = exportLedgerToSiem(rows, "cef");
    // ArcSight/QRadar reject anything not starting CEF:0.
    for (const line of out.body.split("\n")) expect(line.startsWith("CEF:0|Rakshex|")).toBe(true);
  });

  it("emits RFC 5424-shaped syslog", () => {
    const out = exportLedgerToSiem(rows, "syslog");
    for (const line of out.body.split("\n")) expect(line).toMatch(/^<\d+>1 /);
  });

  it("emits Splunk HEC objects with a numeric epoch time", () => {
    const out = exportLedgerToSiem(rows, "splunk_hec");
    const first = JSON.parse(out.body.split("\n")[0]!);
    expect(typeof first.time).toBe("number");
    expect(first.sourcetype).toBe("rakshex:security");
  });

  it("handles an empty ledger without throwing", () => {
    const out = exportLedgerToSiem([], "cef");
    expect(out.recordCount).toBe(0);
  });

  it("never leaks raw parameters into the export", () => {
    // parametersRedacted is not mapped at all — the export carries decision
    // metadata only, so a SIEM operator cannot read action payloads.
    const body = exportLedgerToSiem(rows, "ndjson").body;
    expect(body).not.toContain("parametersRedacted");
  });
});
