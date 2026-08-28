import { describe, expect, it } from "vitest";
import { detectAgentLoop, createRedisLoopStore, type LoopWindowStore } from "./loopDetector";

/** In-memory fixed-window store for tests. */
function memStore(): LoopWindowStore {
  const counts = new Map<string, number>();
  return {
    async bump(key: string) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}

describe("detectAgentLoop", () => {
  it("does not flag normal call volume", async () => {
    const store = memStore();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await detectAgentLoop(
        store,
        { scopeKey: "ws1:agentA", promptHash: "abc" },
        { maxCallsPerWindow: 30, maxDuplicatePrompts: 5 },
      );
    }
    expect(last!.loopDetected).toBe(false);
  });

  it("flags a runaway call-rate loop", async () => {
    const store = memStore();
    let result;
    for (let i = 0; i < 12; i++) {
      result = await detectAgentLoop(
        store,
        { scopeKey: "ws1:agentB" }, // distinct prompts each time (no hash)
        { maxCallsPerWindow: 10, maxDuplicatePrompts: 100 },
      );
    }
    expect(result!.loopDetected).toBe(true);
    expect(result!.callsInWindow).toBe(12);
    expect(result!.reasons.join(" ")).toMatch(/call rate/);
  });

  it("flags a duplicate-prompt reasoning loop", async () => {
    const store = memStore();
    let result;
    for (let i = 0; i < 7; i++) {
      result = await detectAgentLoop(
        store,
        { scopeKey: "ws1:agentC", promptHash: "same-prompt-hash" },
        { maxCallsPerWindow: 1000, maxDuplicatePrompts: 5 },
      );
    }
    expect(result!.loopDetected).toBe(true);
    expect(result!.duplicatePromptCount).toBe(7);
    expect(result!.reasons.join(" ")).toMatch(/repeated/);
  });

  it("createRedisLoopStore returns null without a client", () => {
    expect(createRedisLoopStore(null)).toBeNull();
    expect(createRedisLoopStore(undefined)).toBeNull();
  });

  it("createRedisLoopStore sets TTL only on first increment", async () => {
    const calls: Array<[string, unknown?]> = [];
    let n = 0;
    const fakeRedis = {
      incr: async (k: string) => {
        calls.push(["incr", k]);
        return ++n;
      },
      expire: async (k: string, s: number) => {
        calls.push(["expire", `${k}:${s}`]);
        return 1;
      },
    };
    const store = createRedisLoopStore(fakeRedis)!;
    await store.bump("k", 60); // n=1 -> expire set
    await store.bump("k", 60); // n=2 -> no expire
    const expireCalls = calls.filter((c) => c[0] === "expire");
    expect(expireCalls).toHaveLength(1);
  });
});
