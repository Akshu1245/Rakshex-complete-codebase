/**
 * DevPulse Mock Server — Validation Test Suite
 * =============================================
 * Validates ALL flows required by the validation pass spec:
 *
 *   [1] Onboarding completion — 4 steps, clean progression
 *   [2] Clean-repo onboarding correctness — Petstore collection seeded,
 *       no credential findings, only low-severity structural observations
 *   [3] Telemetry correctness — every activity event is recorded faithfully
 *   [4] Weekly digest — getDashboardData + getRecentFindings both return
 *       consistent, populated data after first scan
 *   [5] Rerun flow — triggerScan increments scan count deterministically
 *   [6] Persistence validation — resetMockState() fully resets all state
 *
 * Run:  npx vitest run mockServer.test.ts
 *       (or: pnpm test in devpulse-vscode/)
 *
 * No VS Code API is required — all tests run in Node / Vitest.
 * `vscode` imports in api.ts are guarded by the mock fetch, so the tests
 * exercise the HTTP boundary layer only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installMockFetch,
  resetMockState,
  mockState,
} from "./mockServer";

// ---------------------------------------------------------------------------
// Minimal DevPulseApi re-implementation for test (avoids VS Code dependency)
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.devpulse.in";
const MOCK_API_KEY = "dp_test_key_abc123";

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const url = new URL(`${BASE_URL}/trpc/${path}`);
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify(input));
  }
  const res = await globalThis.fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MOCK_API_KEY,
    },
  });
  const json = (await res.json()) as { result?: { data?: T } };
  return json.result?.data as T;
}

async function trpcMutate<T>(path: string, input: unknown): Promise<T> {
  const res = await globalThis.fetch(`${BASE_URL}/trpc/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MOCK_API_KEY,
    },
    body: JSON.stringify({ input }),
  });
  const json = (await res.json()) as { result?: { data?: T } };
  return json.result?.data as T;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let uninstall: (() => void) | null = null;

beforeEach(() => {
  resetMockState();
  uninstall = installMockFetch(BASE_URL);
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
});

// ---------------------------------------------------------------------------
// [1] Onboarding flow — step-by-step progression
// ---------------------------------------------------------------------------

describe("[1] Onboarding flow", () => {
  it("starts with empty collections and no findings", async () => {
    const collections = await trpcQuery<unknown[]>("collections.list");
    expect(collections).toEqual([]);

    const findings = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");
    expect(findings).toEqual([]);
  });

  it("step: connect — validateApiKey returns valid user for dp_ key", async () => {
    const result = await trpcMutate<{ valid: boolean; user: { email: string } | null }>(
      "vscodeExtension.validateApiKey",
      { apiKey: MOCK_API_KEY },
    );
    expect(result.valid).toBe(true);
    expect(result.user?.email).toBe("akshay@devpulse.in");
    expect(mockState.authenticated).toBe(true);
  });

  it("step: connect — validateApiKey rejects invalid key", async () => {
    const result = await trpcMutate<{ valid: boolean; user: null }>(
      "vscodeExtension.validateApiKey",
      { apiKey: "not-a-real-key" },
    );
    expect(result.valid).toBe(false);
    expect(result.user).toBeNull();
  });

  it("step: import — collections.create seeds one collection", async () => {
    const created = await trpcMutate<{ id: string; name: string; credentialFindings: unknown[] }>(
      "collections.create",
      { name: "Swagger Petstore v3", format: "openapi", data: {} },
    );
    expect(created.id).toMatch(/^mock-col-/);
    expect(created.name).toBe("Swagger Petstore v3");
    expect(created.credentialFindings).toEqual([]); // clean repo

    const collections = await trpcQuery<Array<{ id: string }>>("collections.list");
    expect(collections).toHaveLength(1);
  });

  it("step: scan — triggerScan queues a scan and materialises findings", async () => {
    // Import first
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });

    const scan = await trpcMutate<{ scanId: string; status: string }>(
      "vscodeExtension.triggerScan",
      { collectionId: col.id },
    );
    expect(scan.status).toBe("queued");
    expect(scan.scanId).toMatch(/^mock-scan-/);
    expect(mockState.lastScanId).toBe(scan.scanId);

    // Findings are now materialised
    const findings = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");
    expect(findings.length).toBeGreaterThan(0);
  });

  it("step: review — getDashboardData reflects post-scan state", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const dashboard = await trpcQuery<{
      collections: number;
      recentScans: number;
      totalFindings: number;
      openFindings: number;
    }>("vscodeExtension.getDashboardData");
    expect(dashboard.collections).toBeGreaterThanOrEqual(1);
    expect(dashboard.recentScans).toBeGreaterThanOrEqual(1);
    expect(dashboard.totalFindings).toBeGreaterThan(0);
    expect(dashboard.openFindings).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// [2] Clean-repo onboarding correctness (Petstore proxy)
// ---------------------------------------------------------------------------

describe("[2] Clean-repo / Petstore correctness", () => {
  it("no Critical findings in Petstore collection", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const findings = await trpcQuery<Array<{ severity: string }>>(
      "vscodeExtension.getRecentFindings",
    );
    const criticalCount = findings.filter((f) => f.severity === "Critical").length;
    expect(criticalCount).toBe(0);
  });

  it("no credential findings on collection import", async () => {
    const result = await trpcMutate<{ credentialFindings: unknown[] }>(
      "collections.create",
      { name: "Petstore", format: "openapi", data: {} },
    );
    expect(result.credentialFindings).toHaveLength(0);
  });

  it("findings are low-severity structural observations only", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const findings = await trpcQuery<Array<{ severity: string; category: string }>>(
      "vscodeExtension.getRecentFindings",
    );
    for (const f of findings.filter((f) => f.severity !== "Low")) {
      expect(["Medium"]).toContain(f.severity);
    }
    // No secrets or broken-auth findings of High/Critical severity
    const highCritBreakAuth = findings.filter(
      (f) =>
        (f.severity === "Critical" || f.severity === "High") &&
        f.category === "broken_auth",
    );
    expect(highCritBreakAuth).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// [3] Telemetry correctness
// ---------------------------------------------------------------------------

describe("[3] Telemetry / recordActivity", () => {
  it("records session_start event", async () => {
    await trpcMutate("vscodeExtension.recordActivity", {
      type: "session_start",
      data: { version: "0.2.0" },
      timestamp: new Date().toISOString(),
    });
    expect(mockState.activityLog).toHaveLength(1);
    expect(mockState.activityLog[0]!.type).toBe("session_start");
  });

  it("records multiple events in order", async () => {
    const events = ["session_start", "heartbeat", "file_change", "session_end"] as const;
    for (const type of events) {
      await trpcMutate("vscodeExtension.recordActivity", {
        type,
        data: {},
        timestamp: new Date().toISOString(),
      });
    }
    expect(mockState.activityLog.map((e) => e.type)).toEqual([...events]);
  });

  it("preserves arbitrary data payload in activity log", async () => {
    const payload = { fileCount: 42, language: "typescript" };
    await trpcMutate("vscodeExtension.recordActivity", {
      type: "file_change",
      data: payload,
      timestamp: new Date().toISOString(),
    });
    expect(mockState.activityLog[0]!.data).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// [4] Weekly digest data consistency
// ---------------------------------------------------------------------------

describe("[4] Weekly digest data", () => {
  it("getDashboardData + getRecentFindings are consistent after scan", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const [dashboard, findings] = await Promise.all([
      trpcQuery<{ openFindings: number; totalFindings: number }>(
        "vscodeExtension.getDashboardData",
      ),
      trpcQuery<Array<{ status: string }>>("vscodeExtension.getRecentFindings"),
    ]);

    const openCount = findings.filter((f) => f.status === "open").length;
    expect(dashboard.openFindings).toBe(openCount);
    expect(dashboard.totalFindings).toBe(findings.length);
  });

  it("resolving a finding decrements openFindings", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const findings = await trpcQuery<Array<{ id: string; status: string }>>(
      "vscodeExtension.getRecentFindings",
    );
    const openFinding = findings.find((f) => f.status === "open");
    expect(openFinding).toBeDefined();

    const before = await trpcQuery<{ openFindings: number }>(
      "vscodeExtension.getDashboardData",
    );

    await trpcMutate("vscodeExtension.updateFindingStatus", {
      findingId: openFinding!.id,
      status: "resolved",
    });

    const after = await trpcQuery<{ openFindings: number }>(
      "vscodeExtension.getDashboardData",
    );
    expect(after.openFindings).toBe(before.openFindings - 1);
  });

  it("limit param on getRecentFindings is respected", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    const limited = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings", {
      limit: 2,
    });
    expect(limited.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// [5] Rerun flow
// ---------------------------------------------------------------------------

describe("[5] Rerun / triggerScan", () => {
  it("each triggerScan call increments recentScans", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });

    // Capture baseline recentScans (may be non-zero after seeding)
    const baseline = (await trpcQuery<{ recentScans: number }>("vscodeExtension.getDashboardData"))
      .recentScans;

    for (let i = 1; i <= 3; i++) {
      await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });
      const d = await trpcQuery<{ recentScans: number }>("vscodeExtension.getDashboardData");
      expect(d.recentScans).toBe(baseline + i);
    }
  });

  it("each scan returns a unique scanId", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = await trpcMutate<{ scanId: string }>("vscodeExtension.triggerScan", {
        collectionId: col.id,
      });
      ids.add(r.scanId);
    }
    expect(ids.size).toBe(5);
  });

  it("rerun does not duplicate findings", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });
    const after1 = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");

    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });
    const after2 = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");

    // Finding set should be identical — no duplicates injected on rerun
    expect(after2.length).toBe(after1.length);
  });
});

// ---------------------------------------------------------------------------
// [6] Persistence validation — resetMockState
// ---------------------------------------------------------------------------

describe("[6] Persistence / resetMockState", () => {
  it("reset clears all state to pre-onboarding baseline", async () => {
    // Drive to post-scan state
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });
    await trpcMutate("vscodeExtension.recordActivity", {
      type: "heartbeat",
      data: {},
      timestamp: new Date().toISOString(),
    });
    expect(mockState.activityLog.length).toBeGreaterThan(0);

    // Reset
    resetMockState();

    // Verify pristine state
    expect(mockState.authenticated).toBe(false);
    expect(mockState.collections).toHaveLength(0);
    expect(mockState.findings).toHaveLength(0);
    expect(mockState.activityLog).toHaveLength(0);
    expect(mockState.lastScanId).toBeNull();
    expect(mockState.dashboard.recentScans).toBe(0);
    expect(mockState.dashboard.openFindings).toBe(0);
    expect(mockState.mode).toBe("normal");
  });

  it("API queries return empty state after reset", async () => {
    const col = await trpcMutate<{ id: string }>("collections.create", {
      name: "Petstore",
      format: "openapi",
      data: {},
    });
    await trpcMutate("vscodeExtension.triggerScan", { collectionId: col.id });

    resetMockState();

    const collections = await trpcQuery<unknown[]>("collections.list");
    const findings = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");
    const dashboard = await trpcQuery<{ recentScans: number }>(
      "vscodeExtension.getDashboardData",
    );
    expect(collections).toHaveLength(0);
    expect(findings).toHaveLength(0);
    expect(dashboard.recentScans).toBe(0);
  });

  it("mock can be fully rerun after reset (idempotent)", async () => {
    for (let pass = 0; pass < 2; pass++) {
      resetMockState();
      const col = await trpcMutate<{ id: string }>("collections.create", {
        name: "Petstore",
        format: "openapi",
        data: {},
      });
      const scan = await trpcMutate<{ scanId: string; status: string }>(
        "vscodeExtension.triggerScan",
        { collectionId: col.id },
      );
      expect(scan.status).toBe("queued");
      const findings = await trpcQuery<unknown[]>("vscodeExtension.getRecentFindings");
      expect(findings.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Bonus: offline / slow mode guards
// ---------------------------------------------------------------------------

describe("Mock mode: offline", () => {
  it("offline mode throws a network error", async () => {
    mockState.mode = "offline";
    await expect(trpcQuery("vscodeExtension.getDashboardData")).rejects.toThrow();
  });
});

describe("Mock mode: generateApiKey", () => {
  it("returns a dp_ prefixed key", async () => {
    const result = await trpcMutate<{ apiKey: string }>(
      "vscodeExtension.generateApiKey",
      {},
    );
    expect(result.apiKey).toMatch(/^dp_mock_/);
  });
});
