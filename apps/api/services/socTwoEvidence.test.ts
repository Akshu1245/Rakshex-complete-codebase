// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  buildEvidencePack,
  defaultWindow,
  SOC_TWO_CONTROLS,
  type CollectEvidenceInputs,
} from "./socTwoEvidence";

const NOW = new Date("2026-05-08T12:00:00Z");
const ms = 24 * 60 * 60 * 1000;

function inWindowDate(daysBack: number): Date {
  return new Date(NOW.getTime() - daysBack * ms);
}

function makeAuditRow(over: Partial<Record<string, unknown>> = {}): never {
  return {
    id: 1,
    userId: 7,
    requestId: "req-1",
    model: "gpt-4o-mini",
    provider: "openai",
    decision: "allowed",
    blockReason: null,
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    estimatedCostUsd: "0.001",
    promptFingerprint: null,
    latencyMs: 120,
    createdAt: inWindowDate(1),
    ...over,
  } as never;
}

function makeRunRow(over: Partial<Record<string, unknown>> = {}): never {
  return {
    id: "run-1",
    userId: 7,
    target: "https://app.example/api/chat",
    triggeredBy: "manual",
    status: "completed",
    totalPayloads: 50,
    blockedCount: 47,
    leakedCount: 3,
    erroredCount: 0,
    securityScore: 85,
    durationMs: 12000,
    startedAt: inWindowDate(2),
    finishedAt: inWindowDate(2),
    createdAt: inWindowDate(2),
    ...over,
  } as never;
}

function makeShadowRow(over: Partial<Record<string, unknown>> = {}): never {
  return {
    id: 1,
    userId: 7,
    source: "gateway",
    detectedHost: "evil-llm.com",
    detectedModel: "gpt-4",
    isAllowlisted: false,
    severity: "high",
    rawSignals: null,
    occurredAt: inWindowDate(3),
    createdAt: inWindowDate(3),
    ...over,
  } as never;
}

function baseInputs(): CollectEvidenceInputs {
  const { windowStart, windowEnd } = defaultWindow(NOW);
  return {
    tenantId: 7,
    windowStart,
    windowEnd,
    audit: [],
    redteamRuns: [],
    shadowEvents: [],
  };
}

describe("buildEvidencePack", () => {
  it("returns an empty/fail-heavy pack when no signals exist", () => {
    const pack = buildEvidencePack(baseInputs(), NOW);
    expect(pack.tenantId).toBe(7);
    expect(pack.controls).toHaveLength(SOC_TWO_CONTROLS.length);
    // at least CC1.4, CC2.2, CC4.1 should fail without any signal
    const cc14 = pack.controls.find((c) => c.controlId === "CC1.4");
    expect(cc14?.verdict).toBe("fail");
  });

  it("flips CC1.4 / CC2.2 to pass once gateway audit rows exist", () => {
    const pack = buildEvidencePack({ ...baseInputs(), audit: [makeAuditRow()] }, NOW);
    const cc14 = pack.controls.find((c) => c.controlId === "CC1.4")!;
    const cc22 = pack.controls.find((c) => c.controlId === "CC2.2")!;
    expect(cc14.verdict).toBe("pass");
    expect(cc22.verdict).toBe("pass");
    expect(cc14.sampleSize).toBe(1);
  });

  it("CC4.1 passes only when at least one red-team run is in window", () => {
    const pack = buildEvidencePack({ ...baseInputs(), redteamRuns: [makeRunRow()] }, NOW);
    const cc41 = pack.controls.find((c) => c.controlId === "CC4.1")!;
    expect(cc41.verdict).toBe("pass");
    expect(cc41.sample).toHaveLength(1);
  });

  it("CC5.1 is partial when audit exists but nothing was blocked", () => {
    const pack = buildEvidencePack(
      { ...baseInputs(), audit: [makeAuditRow({ decision: "allowed" })] },
      NOW,
    );
    const cc51 = pack.controls.find((c) => c.controlId === "CC5.1")!;
    expect(cc51.verdict).toBe("partial");
  });

  it("CC5.1 passes once at least one blocked decision is observed", () => {
    const pack = buildEvidencePack(
      {
        ...baseInputs(),
        audit: [makeAuditRow({ decision: "blocked", blockReason: "prompt_injection" })],
      },
      NOW,
    );
    const cc51 = pack.controls.find((c) => c.controlId === "CC5.1")!;
    expect(cc51.verdict).toBe("pass");
    expect(cc51.sampleSize).toBe(1);
  });

  it("CC6.6 is partial when unallowlisted shadow hosts exist", () => {
    const pack = buildEvidencePack({ ...baseInputs(), shadowEvents: [makeShadowRow()] }, NOW);
    const cc66 = pack.controls.find((c) => c.controlId === "CC6.6")!;
    expect(cc66.verdict).toBe("partial");
  });

  it("CC6.6 passes if all shadow events are allowlisted", () => {
    const pack = buildEvidencePack(
      {
        ...baseInputs(),
        shadowEvents: [makeShadowRow({ isAllowlisted: true })],
      },
      NOW,
    );
    const cc66 = pack.controls.find((c) => c.controlId === "CC6.6")!;
    expect(cc66.verdict).toBe("pass");
  });

  it("CC9.2 records distinct providers in the rationale", () => {
    const pack = buildEvidencePack(
      {
        ...baseInputs(),
        audit: [
          makeAuditRow({ provider: "openai" }),
          makeAuditRow({ provider: "anthropic", id: 2, requestId: "req-2" }),
          makeAuditRow({ provider: "openai", id: 3, requestId: "req-3" }),
        ],
      },
      NOW,
    );
    const cc92 = pack.controls.find((c) => c.controlId === "CC9.2")!;
    expect(cc92.verdict).toBe("pass");
    expect(cc92.rationale).toMatch(/openai/);
    expect(cc92.rationale).toMatch(/anthropic/);
  });

  it("A1.2 is na with zero deliveries, pass with ≥95% success", () => {
    const naPack = buildEvidencePack(baseInputs(), NOW);
    expect(naPack.controls.find((c) => c.controlId === "A1.2")!.verdict).toBe("na");

    const successDeliveries = Array.from({ length: 100 }).map(() => ({
      success: true,
      httpStatus: 200,
      createdAt: inWindowDate(1),
    }));
    const passPack = buildEvidencePack(
      { ...baseInputs(), webhookDeliveries: successDeliveries },
      NOW,
    );
    expect(passPack.controls.find((c) => c.controlId === "A1.2")!.verdict).toBe("pass");

    const mixed = [
      ...Array.from({ length: 80 }).map(() => ({
        success: true,
        httpStatus: 200,
        createdAt: inWindowDate(1),
      })),
      ...Array.from({ length: 20 }).map(() => ({
        success: false,
        httpStatus: 500,
        createdAt: inWindowDate(1),
      })),
    ];
    const failPack = buildEvidencePack({ ...baseInputs(), webhookDeliveries: mixed }, NOW);
    expect(failPack.controls.find((c) => c.controlId === "A1.2")!.verdict).toBe("fail");
  });

  it("C1.1 always passes by design (collection import scanner is wired)", () => {
    const pack = buildEvidencePack(baseInputs(), NOW);
    const c11 = pack.controls.find((c) => c.controlId === "C1.1")!;
    expect(c11.verdict).toBe("pass");
  });

  it("computes summary roll-up across all controls", () => {
    const pack = buildEvidencePack(
      {
        ...baseInputs(),
        audit: [makeAuditRow({ decision: "blocked", blockReason: "prompt_injection" })],
        redteamRuns: [makeRunRow()],
      },
      NOW,
    );
    expect(pack.summary.pass + pack.summary.partial + pack.summary.fail + pack.summary.na).toBe(
      SOC_TWO_CONTROLS.length,
    );
  });

  it("redacts request bodies from gateway audit samples", () => {
    const pack = buildEvidencePack({ ...baseInputs(), audit: [makeAuditRow()] }, NOW);
    const cc22 = pack.controls.find((c) => c.controlId === "CC2.2")!;
    expect(cc22.sample[0]).not.toHaveProperty("requestBody");
    expect(cc22.sample[0]).not.toHaveProperty("responseBody");
    expect(cc22.sample[0]).toHaveProperty("decision");
    expect(cc22.sample[0]).toHaveProperty("createdAt");
  });

  it("excludes data outside the window", () => {
    const oldRow = makeAuditRow({ createdAt: inWindowDate(200) });
    const pack = buildEvidencePack({ ...baseInputs(), audit: [oldRow] }, NOW);
    expect(pack.controls.find((c) => c.controlId === "CC1.4")!.sampleSize).toBe(0);
  });
});

describe("defaultWindow", () => {
  it("returns a 90-day trailing window", () => {
    const { windowStart, windowEnd } = defaultWindow(NOW);
    const days = Math.round((windowEnd.getTime() - windowStart.getTime()) / ms);
    expect(days).toBe(90);
  });
});
