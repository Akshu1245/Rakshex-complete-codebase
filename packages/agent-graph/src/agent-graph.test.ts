import { describe, expect, it } from "vitest";
import { buildExecutionGraph, summarizeRun } from "./graph.js";
import { buildReplay, seekReplay } from "./replay.js";
import type { AgentEvent } from "./types.js";

function ev(partial: Omit<AgentEvent, "runId"> & { runId?: string }): AgentEvent {
  return { runId: "run-1", ...partial };
}

const sample: AgentEvent[] = [
  ev({
    id: "1",
    type: "run.started",
    timestamp: "2026-01-01T00:00:00.000Z",
    payload: {},
  }),
  ev({
    id: "2",
    type: "step.started",
    timestamp: "2026-01-01T00:00:01.000Z",
    stepId: "s1",
    payload: { name: "plan" },
  }),
  ev({
    id: "3",
    type: "llm.request",
    timestamp: "2026-01-01T00:00:02.000Z",
    stepId: "s1",
    payload: { model: "gpt-5-mini" },
  }),
  ev({
    id: "4",
    type: "llm.response",
    timestamp: "2026-01-01T00:00:03.000Z",
    stepId: "s1",
    parentEventId: "3",
    payload: { tokens: 100 },
  }),
  ev({
    id: "5",
    type: "tool.call",
    timestamp: "2026-01-01T00:00:04.000Z",
    stepId: "s1",
    payload: { toolName: "search" },
  }),
  ev({
    id: "6",
    type: "tool.blocked",
    timestamp: "2026-01-01T00:00:05.000Z",
    stepId: "s1",
    payload: { toolName: "execute_shell", reason: "policy" },
  }),
  ev({
    id: "7",
    type: "cost.updated",
    timestamp: "2026-01-01T00:00:06.000Z",
    payload: { costUsd: 0.12 },
  }),
  ev({
    id: "8",
    type: "run.completed",
    timestamp: "2026-01-01T00:00:10.000Z",
    payload: {},
  }),
];

describe("buildExecutionGraph", () => {
  it("builds nodes and edges", () => {
    const g = buildExecutionGraph("run-1", sample);
    expect(g.rootNodeId).toBe("run:run-1");
    expect(g.nodes.some((n) => n.kind === "step")).toBe(true);
    expect(g.nodes.some((n) => n.kind === "llm")).toBe(true);
    expect(g.nodes.some((n) => n.status === "blocked")).toBe(true);
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it("summarizes run", () => {
    const s = summarizeRun("run-1", sample);
    expect(s.status).toBe("completed");
    expect(s.stepCount).toBe(1);
    expect(s.llmCallCount).toBe(1);
    expect(s.blockedCount).toBe(1);
    expect(s.totalCostUsd).toBe(0.12);
    expect(s.durationMs).toBe(10_000);
  });
});

describe("replay", () => {
  it("produces one frame per event", () => {
    const frames = buildReplay("run-1", sample);
    expect(frames).toHaveLength(sample.length);
    expect(frames[0]?.graph.nodes.find((n) => n.id === "run:run-1")?.status).toBe("running");
    const last = seekReplay(frames, 999);
    expect(last?.graph.nodes.find((n) => n.id === "run:run-1")?.status).toBe("completed");
  });
});
