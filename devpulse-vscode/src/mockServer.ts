/**
 * DevPulse Mock Server — HTTP Boundary Interceptor
 * =================================================
 * Intercepts ALL outbound `fetch` calls made by `DevPulseApi` and returns
 * deterministic, seeded responses without any real network traffic.
 *
 * Design decisions:
 *   - Mock is installed at the raw `fetch` boundary — zero changes to
 *     DevPulseApi, OnboardingTour, WeeklyDigest, or any other consumer.
 *   - Data is seeded from the public Swagger Petstore as the "clean-repo
 *     proxy" — well-known, stable, and zero-noise.
 *   - Every response is wrapped in the tRPC v11 envelope so DevPulseApi's
 *     `handleResponse()` works without modification.
 *   - Mock is scoped to the DevPulse tRPC base URL — any other fetch
 *     (e.g. VS Code's own extension gallery) is forwarded to the real fetch.
 *   - `mockState` is fully mutable so tests can drive deterministic flows
 *     (onboarding step progression, scan state changes, etc.).
 *
 * Validation pass scope:
 *   ✅  Onboarding completion (4 steps)
 *   ✅  Clean-repo onboarding correctness (Petstore collection seeded)
 *   ✅  Telemetry / recordActivity (activity event sink)
 *   ✅  Weekly digest rendering (dashboard + findings data)
 *   ✅  Rerun / triggerScan flow
 *   ✅  Persistence validation (globalState-independent mock state reset)
 */

import type { DashboardData, Finding, Collection, ValidatedUser } from "./api";

// ---------------------------------------------------------------------------
// Petstore-seeded collection data (clean-repo proxy)
// ---------------------------------------------------------------------------

/** Mirrors a real Postman collection backed by petstore3.swagger.io */
const PETSTORE_COLLECTION: Collection = {
  id: "mock-col-petstore",
  name: "Swagger Petstore v3",
  isShared: false,
};

/**
 * Petstore-derived findings. These represent the *expected* output for a
 * clean repo: no secrets, no broken auth — only low-severity structural
 * observations so the onboarding "scan" step returns meaningful but
 * non-alarming data.
 */
const PETSTORE_FINDINGS: Finding[] = [
  {
    id: "mock-f-001",
    title: "No authentication scheme defined on /pet endpoints",
    severity: "Medium",
    status: "open",
    category: "broken_auth",
    collectionName: "Swagger Petstore v3",
  },
  {
    id: "mock-f-002",
    title: "Response schema allows arbitrary additionalProperties",
    severity: "Low",
    status: "open",
    category: "data_exposure",
    collectionName: "Swagger Petstore v3",
  },
  {
    id: "mock-f-003",
    title: "Missing rate-limit headers on /store/inventory",
    severity: "Low",
    status: "open",
    category: "rate_limiting",
    collectionName: "Swagger Petstore v3",
  },
  {
    id: "mock-f-004",
    title: "Deprecated TLS cipher suite in server config",
    severity: "Low",
    status: "resolved",
    category: "transport",
    collectionName: "Swagger Petstore v3",
  },
];

const PETSTORE_DASHBOARD: DashboardData = {
  collections: 1,
  recentScans: 1,
  totalFindings: 4,
  openFindings: 3,
  weeklyCost: 0,
  lastScanAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mutable mock state — mutate to drive flow progression
// ---------------------------------------------------------------------------

export interface MockState {
  /** Whether the mock has been "authenticated" via validateApiKey */
  authenticated: boolean;
  /** Simulated user after API key validation */
  validatedUser: ValidatedUser;
  /** Current collections visible to the extension */
  collections: Collection[];
  /** Current findings */
  findings: Finding[];
  /** Dashboard snapshot */
  dashboard: DashboardData;
  /** Recorded activity events (append-only for telemetry validation) */
  activityLog: Array<{ type: string; data: unknown; timestamp: string }>;
  /** Last scan ID issued by triggerScan */
  lastScanId: string | null;
  /** Whether onboarding is considered complete (≥4 steps done) */
  onboardingComplete: boolean;
  /**
   * Intercept mode:
   *   "normal"  — respond to every call
   *   "offline" — throw network error (tests resilientFetch retry logic)
   *   "slow"    — add artificial 1500 ms delay before each response
   */
  mode: "normal" | "offline" | "slow";
}

export const mockState: MockState = {
  authenticated: false,
  validatedUser: {
    id: 1,
    email: "akshay@devpulse.in",
    name: "Akshay",
    plan: "pro",
  },
  collections: [],          // empty until after "import" step
  findings: [],             // empty until after first scan
  dashboard: { ...PETSTORE_DASHBOARD, collections: 0, recentScans: 0, openFindings: 0, totalFindings: 0, lastScanAt: null },
  activityLog: [],
  lastScanId: null,
  onboardingComplete: false,
  mode: "normal",
};
/** Monotonic counter for unique IDs across rapid calls */
let _mockCounter = 0;


/** Reset all mock state to pristine pre-onboarding state */
export function resetMockState(): void {
  mockState.authenticated = false;
  mockState.collections = [];
  mockState.findings = [];
  mockState.dashboard = {
    ...PETSTORE_DASHBOARD,
    collections: 0,
    recentScans: 0,
    openFindings: 0,
    totalFindings: 0,
    lastScanAt: null,
  };
  mockState.activityLog = [];
  mockState.lastScanId = null;
  mockState.onboardingComplete = false;
  mockState.mode = "normal";
  _mockCounter = 0;
}

// ---------------------------------------------------------------------------
// tRPC envelope helpers
// ---------------------------------------------------------------------------

function trpcOk<T>(data: T): Response {
  const body = JSON.stringify({ result: { data } });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function trpcError(message: string, status = 400): Response {
  const body = JSON.stringify({ error: { message, code: status } });
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function networkError(): never {
  throw new TypeError("DevPulse mock: simulated network error (mode=offline)");
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

type RouteHandler = (
  path: string,
  method: string,
  body: unknown,
  query: URLSearchParams,
) => Response | Promise<Response>;

const routes: Record<string, RouteHandler> = {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  "vscodeExtension.validateApiKey": (_path, _method, body) => {
    const { apiKey } = (body as { input?: { apiKey?: string } })?.input ?? {};
    if (!apiKey || !apiKey.startsWith("dp_")) {
      return trpcOk({ valid: false, user: null });
    }
    mockState.authenticated = true;
    return trpcOk({ valid: true, user: mockState.validatedUser });
  },

  "vscodeExtension.generateApiKey": () => {
    return trpcOk({ apiKey: "dp_mock_" + Math.random().toString(36).slice(2, 18) });
  },

  // ─── Dashboard ────────────────────────────────────────────────────────────
  "vscodeExtension.getDashboardData": () => {
    return trpcOk(mockState.dashboard);
  },

  "vscodeExtension.getRecentFindings": (_path, _method, _body, query) => {
    let findings = [...mockState.findings];
    const inputStr = query.get("input");
    if (inputStr) {
      try {
        const parsed = JSON.parse(inputStr) as { limit?: number };
        if (typeof parsed.limit === "number") {
          findings = findings.slice(0, parsed.limit);
        }
      } catch {
        /* ignore */
      }
    }
    return trpcOk(findings);
  },

  // ─── Collections ──────────────────────────────────────────────────────────
  "collections.list": () => {
    return trpcOk(mockState.collections);
  },

  "collections.create": (_path, _method, body) => {
    const input = (body as { input?: { name?: string; format?: string; data?: unknown } })?.input;
    const name = input?.name ?? "Imported Collection";
    // Seed Petstore data on first import
    const newCol: Collection = {
      id: `mock-col-${++_mockCounter}`,
      name,
      isShared: false,
    };
    mockState.collections.push(newCol);
    mockState.dashboard.collections = mockState.collections.length;

    // Return with petstore-style findings preview
    return trpcOk({
      id: newCol.id,
      name: newCol.name,
      credentialFindings: [], // clean repo — no credential leaks
    });
  },

  // ─── Scanning ─────────────────────────────────────────────────────────────
  "vscodeExtension.triggerScan": (_path, _method, body) => {
    const { collectionId } = (body as { input?: { collectionId?: string } })?.input ?? {};
    if (!collectionId) {
      return trpcError("collectionId is required", 400);
    }
    const scanId = `mock-scan-${++_mockCounter}`;
    mockState.lastScanId = scanId;

    // Materialise petstore findings after first scan
    if (mockState.findings.length === 0) {
      mockState.findings = [...PETSTORE_FINDINGS];
      // Seed dashboard but preserve recentScans counter (starts at 0, incremented below)
      mockState.dashboard = { ...PETSTORE_DASHBOARD, recentScans: mockState.dashboard.recentScans };
    }

    mockState.dashboard.recentScans += 1;
    mockState.dashboard.lastScanAt = new Date().toISOString();

    return trpcOk({ scanId, status: "queued" });
  },

  // ─── Finding status updates ────────────────────────────────────────────────
  "vscodeExtension.updateFindingStatus": (_path, _method, body) => {
    const { findingId, status } =
      (body as { input?: { findingId?: string; status?: string } })?.input ?? {};
    const finding = mockState.findings.find((f) => f.id === findingId);
    if (!finding) {
      return trpcError(`Finding ${findingId} not found`, 404);
    }
    finding.status = status as Finding["status"];
    mockState.dashboard.openFindings = mockState.findings.filter(
      (f) => f.status === "open",
    ).length;
    return trpcOk({ success: true });
  },

  // ─── Activity / Telemetry ─────────────────────────────────────────────────
  "vscodeExtension.recordActivity": (_path, _method, body) => {
    const input = (body as { input?: { type: string; data: unknown; timestamp: string } })?.input;
    if (input) {
      mockState.activityLog.push({
        type: input.type,
        data: input.data,
        timestamp: input.timestamp,
      });
    }
    return trpcOk({ success: true });
  },

  // ─── Copilot ──────────────────────────────────────────────────────────────
  "vscodeExtension.copilotAsk": (_path, _method, body) => {
    const { question } = (body as { input?: { question?: string } })?.input ?? {};
    const q = (question ?? "").toLowerCase();
    let response =
      "The Swagger Petstore API is a clean reference implementation. No critical security issues were detected in this collection.";
    if (q.includes("auth") || q.includes("key")) {
      response =
        "The Petstore collection does not include API keys or bearer tokens, which is expected for a public demo API. In production, ensure all sensitive endpoints require authentication.";
    } else if (q.includes("cost") || q.includes("token")) {
      response =
        "No hidden token costs detected in this collection. The Petstore API uses standard REST patterns without LLM inference calls.";
    } else if (q.includes("fix") || q.includes("resolv")) {
      response =
        "To resolve the open findings: (1) Add an OAuth2 or API key security scheme to /pet endpoints. (2) Tighten response schemas by setting additionalProperties: false.";
    }
    return trpcOk({ response });
  },
};

// ---------------------------------------------------------------------------
// Core interceptor
// ---------------------------------------------------------------------------

const REAL_FETCH = globalThis.fetch;
const DEVPULSE_TRPC_PATH = "/trpc/";

/**
 * Install the mock fetch interceptor. Must be called once at extension
 * activation time when `devpulse.mockMode` is `true`.
 *
 * Returns an `uninstall` function that restores the real fetch.
 */
export function installMockFetch(baseUrl: string): () => void {
  const base = baseUrl.replace(/\/+$/, "");

  globalThis.fetch = async function mockedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Pass through any request that doesn't target DevPulse
    if (!url.startsWith(base)) {
      return REAL_FETCH(input, init);
    }

    // Handle mock mode
    if (mockState.mode === "offline") {
      networkError();
    }
    if (mockState.mode === "slow") {
      await delay(1500);
    }

    const parsed = new URL(url);
    // Extract tRPC path: everything after /trpc/
    const trpcIndex = parsed.pathname.indexOf(DEVPULSE_TRPC_PATH);
    if (trpcIndex === -1) {
      // Not a tRPC route — pass through
      return REAL_FETCH(input, init);
    }

    const routeKey = parsed.pathname.slice(trpcIndex + DEVPULSE_TRPC_PATH.length);
    const method = (init?.method ?? "GET").toUpperCase();

    let body: unknown = undefined;
    if (method === "POST" && init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        /* leave undefined */
      }
    }

    const handler = routes[routeKey];
    if (!handler) {
      console.warn(`[DevPulse Mock] Unhandled route: ${method} ${routeKey}`);
      return trpcError(`Mock: no handler for ${routeKey}`, 404);
    }

    try {
      return await handler(routeKey, method, body, parsed.searchParams);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return trpcError(`Mock handler error: ${msg}`, 500);
    }
  };

  return function uninstallMockFetch() {
    globalThis.fetch = REAL_FETCH;
  };
}
