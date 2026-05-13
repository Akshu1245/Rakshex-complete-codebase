// @ts-nocheck  
import { describe, it, expect } from "vitest";
import {
  computeShadowDrift,
  computeWowRegressions,
  detectFollowUp,
  parseDateRange,
} from "./copilotIntents";

const FIXED_NOW = new Date("2026-05-08T12:00:00Z");
const ms = 24 * 60 * 60 * 1000;

describe("parseDateRange", () => {
  it("returns null for queries without a recognised range", () => {
    expect(parseDateRange("how many calls did we have", FIXED_NOW)).toBeNull();
    expect(parseDateRange("show me everything", FIXED_NOW)).toBeNull();
  });

  it("parses 'today' as the current calendar day", () => {
    const r = parseDateRange("how many blocks today", FIXED_NOW);
    expect(r).not.toBeNull();
    expect(r?.label).toBe("today");
    expect(r?.start.toISOString().startsWith("2026-05-08")).toBe(true);
  });

  it("parses 'last 30 days' to a 30-day window", () => {
    const r = parseDateRange("show me costs last 30 days", FIXED_NOW);
    expect(r?.label).toBe("last 30 days");
    expect(Math.round((FIXED_NOW.getTime() - r!.start.getTime()) / ms)).toBe(30);
  });

  it("parses 'past 7 days' equivalently to 'last 7 days'", () => {
    const a = parseDateRange("blocks past 7 days", FIXED_NOW);
    const b = parseDateRange("blocks last 7 days", FIXED_NOW);
    expect(a?.label).toBe(b?.label);
  });

  it("parses 'between YYYY-MM-DD and YYYY-MM-DD'", () => {
    const r = parseDateRange(
      "show me between 2026-04-01 and 2026-04-15",
      FIXED_NOW
    );
    expect(r?.label).toBe("2026-04-01 to 2026-04-15");
    expect(r?.start.toISOString().startsWith("2026-04-01")).toBe(true);
    expect(r?.end.toISOString().startsWith("2026-04-15")).toBe(true);
  });

  it("rejects backward ranges", () => {
    expect(
      parseDateRange("between 2026-04-15 and 2026-04-01", FIXED_NOW)
    ).toBeNull();
  });

  it("clamps absurdly large day windows to 365", () => {
    const r = parseDateRange("last 9999 days", FIXED_NOW);
    expect(Math.round((FIXED_NOW.getTime() - r!.start.getTime()) / ms)).toBe(365);
  });
});

describe("computeWowRegressions", () => {
  const audit = [
    // This week: $100 cost, 3 blocked
    {
      decision: "blocked",
      estimatedCostUsd: 30,
      createdAt: new Date(FIXED_NOW.getTime() - 1 * ms),
    },
    {
      decision: "blocked",
      estimatedCostUsd: 30,
      createdAt: new Date(FIXED_NOW.getTime() - 2 * ms),
    },
    {
      decision: "blocked",
      estimatedCostUsd: 20,
      createdAt: new Date(FIXED_NOW.getTime() - 3 * ms),
    },
    {
      decision: "allowed",
      estimatedCostUsd: 20,
      createdAt: new Date(FIXED_NOW.getTime() - 4 * ms),
    },
    // Prior week: $50 cost, 1 blocked
    {
      decision: "blocked",
      estimatedCostUsd: 25,
      createdAt: new Date(FIXED_NOW.getTime() - 8 * ms),
    },
    {
      decision: "allowed",
      estimatedCostUsd: 25,
      createdAt: new Date(FIXED_NOW.getTime() - 9 * ms),
    },
    // Outside both windows — should be ignored
    {
      decision: "blocked",
      estimatedCostUsd: 999,
      createdAt: new Date(FIXED_NOW.getTime() - 30 * ms),
    },
  ];
  const runs = [
    {
      status: "completed",
      securityScore: 60,
      finishedAt: new Date(FIXED_NOW.getTime() - 1 * ms),
      createdAt: new Date(FIXED_NOW.getTime() - 1 * ms),
    },
    {
      status: "completed",
      securityScore: 80,
      finishedAt: new Date(FIXED_NOW.getTime() - 8 * ms),
      createdAt: new Date(FIXED_NOW.getTime() - 8 * ms),
    },
  ];

  it("flags cost as a regression when this-week is higher", () => {
    const signals = computeWowRegressions(audit, runs, FIXED_NOW);
    const cost = signals.find(s => s.signal === "cost_usd")!;
    expect(cost.thisWeek).toBe(100);
    expect(cost.priorWeek).toBe(50);
    expect(cost.delta).toBe(50);
    expect(cost.pctChange).toBeCloseTo(100, 1);
    expect(cost.isRegression).toBe(true);
  });

  it("flags blocked count as a regression when this-week is higher", () => {
    const signals = computeWowRegressions(audit, runs, FIXED_NOW);
    const blocked = signals.find(s => s.signal === "blocked_attempts")!;
    expect(blocked.thisWeek).toBe(3);
    expect(blocked.priorWeek).toBe(1);
    expect(blocked.isRegression).toBe(true);
  });

  it("flags red-team score as a regression when score drops", () => {
    const signals = computeWowRegressions(audit, runs, FIXED_NOW);
    const score = signals.find(s => s.signal === "redteam_score")!;
    expect(score.thisWeek).toBe(60);
    expect(score.priorWeek).toBe(80);
    expect(score.delta).toBe(-20);
    expect(score.isRegression).toBe(true);
  });

  it("returns null pctChange when prior week is zero", () => {
    const empty: typeof audit = [];
    const onlyRun = [
      {
        status: "completed",
        securityScore: 70,
        finishedAt: new Date(FIXED_NOW.getTime() - 1 * ms),
        createdAt: new Date(FIXED_NOW.getTime() - 1 * ms),
      },
    ];
    const signals = computeWowRegressions(empty, onlyRun, FIXED_NOW);
    expect(signals.find(s => s.signal === "cost_usd")!.pctChange).toBeNull();
    expect(
      signals.find(s => s.signal === "blocked_attempts")!.pctChange
    ).toBeNull();
  });
});

describe("computeShadowDrift", () => {
  const events = [
    // Recent week (last 7 days): hosts evil-llm.com (new), legit-llm.com (steady)
    {
      detectedHost: "evil-llm.com",
      isAllowlisted: false,
      createdAt: new Date(FIXED_NOW.getTime() - 1 * ms),
    },
    {
      detectedHost: "evil-llm.com",
      isAllowlisted: false,
      createdAt: new Date(FIXED_NOW.getTime() - 2 * ms),
    },
    {
      detectedHost: "legit-llm.com",
      isAllowlisted: false,
      createdAt: new Date(FIXED_NOW.getTime() - 3 * ms),
    },
    // Allowlisted should be excluded entirely
    {
      detectedHost: "openai.com",
      isAllowlisted: true,
      createdAt: new Date(FIXED_NOW.getTime() - 1 * ms),
    },
    // Prior window (7-14 days ago): legit-llm.com (steady), gone-llm.com (vanished)
    {
      detectedHost: "legit-llm.com",
      isAllowlisted: false,
      createdAt: new Date(FIXED_NOW.getTime() - 9 * ms),
    },
    {
      detectedHost: "gone-llm.com",
      isAllowlisted: false,
      createdAt: new Date(FIXED_NOW.getTime() - 10 * ms),
    },
  ];

  it("identifies new hosts with their first-seen + call count", () => {
    const drift = computeShadowDrift(events, FIXED_NOW, 7);
    expect(drift.newHosts.map(h => h.host)).toEqual(["evil-llm.com"]);
    expect(drift.newHosts[0].calls).toBeGreaterThanOrEqual(1);
  });

  it("identifies vanished hosts seen in prior window only", () => {
    const drift = computeShadowDrift(events, FIXED_NOW, 7);
    expect(drift.vanishedHosts.map(h => h.host)).toEqual(["gone-llm.com"]);
  });

  it("counts steady hosts present in both windows", () => {
    const drift = computeShadowDrift(events, FIXED_NOW, 7);
    expect(drift.steadyCount).toBe(1); // legit-llm.com
  });

  it("returns empty arrays when there are no events", () => {
    const drift = computeShadowDrift([], FIXED_NOW, 7);
    expect(drift).toEqual({ newHosts: [], vanishedHosts: [], steadyCount: 0 });
  });
});

describe("detectFollowUp", () => {
  const messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    references: Array<{ kind: string; label: string }>;
  }> = [
    { role: "user", references: [] },
    {
      role: "assistant",
      references: [
        { kind: "_intent", label: "most_expensive_model" },
        { kind: "page", label: "Cost dashboard" },
      ],
    },
  ];

  it("returns isFollowUp=false for self-contained queries", () => {
    expect(
      detectFollowUp(
        "show me the latest red-team score",
        messages as never
      ).isFollowUp
    ).toBe(false);
  });

  it("detects 'and what about ...' as a follow-up", () => {
    const r = detectFollowUp("and what about last week", messages as never);
    expect(r.isFollowUp).toBe(true);
    expect(r.priorIntent).toBe("most_expensive_model");
  });

  it("detects 'same for ...' as a follow-up", () => {
    const r = detectFollowUp("same for last 30 days", messages as never);
    expect(r.isFollowUp).toBe(true);
  });

  it("detects 'now show me ...' as a follow-up", () => {
    const r = detectFollowUp("now show me yesterday", messages as never);
    expect(r.isFollowUp).toBe(true);
  });

  it("returns isFollowUp=true with no priorIntent if there's no assistant turn yet", () => {
    const r = detectFollowUp("and what about last week", []);
    expect(r.isFollowUp).toBe(true);
    expect(r.priorIntent).toBeUndefined();
  });
});
