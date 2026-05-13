// @ts-nocheck  
/**
 * Scanning Router Tests - Phase 21 Testing
 * Tests for security scanning functionality
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "../routers";
import { generateCsrfToken } from "../utils/security";
import type { TrpcContext } from "../_core/context";

// Mock dependencies
vi.mock("../db", async () => {
  const mockCollections = new Map();
  const mockScans = new Map();
  const mockFindings = new Map();

  return {
    getCollectionById: vi.fn(
      async (id: string) => mockCollections.get(id) || null
    ),
    createScan: vi.fn(async (...args: any[]) => {
      const id = `scan_${Date.now()}`;
      mockScans.set(id, { id, status: "completed", ...args[2] });
      return { id };
    }),
    getScansByCollectionId: vi.fn(async (collectionId: string) => {
      return Array.from(mockScans.values()).filter(
        s => s.collectionId === collectionId
      );
    }),
    getScanById: vi.fn(async (id: string) => mockScans.get(id) || null),
    createFinding: vi.fn(async (...args: any[]) => {
      const id = `finding_${Date.now()}`;
      mockFindings.set(id, { id, ...args });
      return { id };
    }),
    getFindingsByScanId: vi.fn(async (scanId: string) => {
      return Array.from(mockFindings.values()).filter(f => f.scanId === scanId);
    }),
    getFindingById: vi.fn(async (id: string) => mockFindings.get(id) || null),
    updateFindingStatus: vi.fn(async () => {}),
    getCollectionsByUserId: vi.fn(async () => []),
    updateCollectionLastScannedAt: vi.fn(async () => {}),
    getUserById: vi.fn(async () => ({
      id: 1,
      email: "test@example.com",
      name: "Test User",
    })),
  };
});

vi.mock("../services/scanService", () => ({
  runCollectionScan: vi.fn(async () => ({
    scanId: "scan_test",
    riskScore: 45,
    riskLevel: "MEDIUM",
    totalFindings: 3,
    findings: [
      {
        id: "f1",
        title: "Test Finding",
        severity: "Medium",
        description: "Test",
        category: "Test",
        remediation: "Fix it",
        cweId: "CWE-000",
      },
    ],
  })),
}));

vi.mock("../websocket", () => ({
  wsManager: {
    broadcastScanStarted: vi.fn(),
    broadcastScanComplete: vi.fn(),
  },
}));

vi.mock("../_core/cache", () => ({
  invalidateUserCache: vi.fn(),
  getOrSetCache: vi.fn(async (_: string, __: number, fn: () => Promise<any>) =>
    fn()
  ),
  CACHE_TTL: { SCAN_RESULTS: 60 },
  cacheKeys: { scanResults: (id: string) => `scan:${id}` },
}));

function createAuthContext(userId: number = 1, role: string = "editor") {
  const csrfToken = generateCsrfToken();
  return {
    ctx: {
      user: {
        id: userId,
        openId: "test-openid",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "test",
        role,
        onboardingCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {
        protocol: "https",
        headers: {
          cookie: `csrf-token=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
        ip: "127.0.0.1",
      },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext,
  };
}

function createNonAuthContext() {
  const csrfToken = generateCsrfToken();
  return {
    ctx: {
      user: null,
      req: {
        protocol: "https",
        headers: {
          cookie: `csrf-token=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
        ip: "127.0.0.1",
      },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext,
  };
}

describe("scanning router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startScan", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createNonAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scanning.startScan({ collectionId: "col_123", scanType: "full" })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws when user is viewer (no editor/admin role)", async () => {
      const { ctx } = createAuthContext(1, "viewer");
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scanning.startScan({ collectionId: "col_123", scanType: "full" })
      ).rejects.toThrow();
    });

    it("throws when collection does not exist", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      // Mock getCollectionById to return null
      const { getCollectionById } = await import("../db");
      vi.mocked(getCollectionById).mockResolvedValueOnce(null);

      await expect(
        caller.scanning.startScan({
          collectionId: "nonexistent",
          scanType: "full",
        })
      ).rejects.toThrow("Collection not found or access denied");
    });

    it("throws when trying to scan another user's collection", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      // Mock getCollectionById to return collection owned by user 999
      const { getCollectionById } = await import("../db");
      vi.mocked(getCollectionById).mockResolvedValueOnce({
        id: "col_123",
        userId: 999, // Different user
        name: "Test Collection",
      });

      await expect(
        caller.scanning.startScan({ collectionId: "col_123", scanType: "full" })
      ).rejects.toThrow("Collection not found or access denied");
    });

    it("successfully starts a scan on owned collection", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      // Mock getCollectionById to return collection owned by user 1
      const { getCollectionById } = await import("../db");
      vi.mocked(getCollectionById).mockResolvedValueOnce({
        id: "col_123",
        userId: 1,
        name: "My Collection",
        data: { item: [] },
      });

      const result = await caller.scanning.startScan({
        collectionId: "col_123",
        scanType: "full",
      });

      expect(result).toBeDefined();
      expect(result.scanId).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.totalFindings).toBeGreaterThanOrEqual(0);
    });

    it("starts a shadow_api scan type", async () => {
      const { ctx } = createAuthContext(1, "editor");
      // shadow_api is a Pro-gated scan type (see server/payments.ts
      // PLAN_CONFIG). Fixture must reflect an upgraded plan.
      (ctx.user as any).plan = "pro";
      const caller = appRouter.createCaller(ctx);

      const { getCollectionById } = await import("../db");
      vi.mocked(getCollectionById).mockResolvedValueOnce({
        id: "col_123",
        userId: 1,
        name: "My Collection",
        data: { item: [] },
      });

      const result = await caller.scanning.startScan({
        collectionId: "col_123",
        scanType: "shadow_api",
      });

      expect(result).toBeDefined();
    });
  });

  describe("listScans", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createNonAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scanning.listScans({
          collectionId: "col_123",
          page: 1,
          pageSize: 20,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("returns empty list for collection with no scans", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getCollectionById, getScansByCollectionId } = await import(
        "../db"
      );
      vi.mocked(getCollectionById).mockResolvedValueOnce({
        id: "col_123",
        userId: 1,
      });
      vi.mocked(getScansByCollectionId).mockResolvedValueOnce([]);

      const result = await caller.scanning.listScans({
        collectionId: "col_123",
      });

      expect(result.scans).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
    });

    it("filters by scanType when specified", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getCollectionById, getScansByCollectionId } = await import(
        "../db"
      );
      vi.mocked(getCollectionById).mockResolvedValueOnce({
        id: "col_123",
        userId: 1,
      });
      vi.mocked(getScansByCollectionId).mockResolvedValueOnce([
        {
          id: "scan1",
          scanType: "full",
          status: "completed",
          riskScore: "30",
          riskLevel: "MEDIUM",
          totalFindings: 2,
        },
        {
          id: "scan2",
          scanType: "quick",
          status: "completed",
          riskScore: "20",
          riskLevel: "LOW",
          totalFindings: 1,
        },
        {
          id: "scan3",
          scanType: "full",
          status: "completed",
          riskScore: "45",
          riskLevel: "MEDIUM",
          totalFindings: 3,
        },
      ]);

      const result = await caller.scanning.listScans({
        collectionId: "col_123",
        scanType: "full",
      });

      expect(result.scans.length).toBe(2);
      expect(result.total).toBe(2);
      result.scans.forEach(scan => {
        expect(scan.scanType).toBe("full");
      });
    });
  });

  describe("getScan", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createNonAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scanning.getScan({ scanId: "scan_123" })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws when scan does not exist", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getScanById } = await import("../db");
      vi.mocked(getScanById).mockResolvedValueOnce(null);

      await expect(
        caller.scanning.getScan({ scanId: "nonexistent" })
      ).rejects.toThrow("Scan not found or access denied");
    });

    it("returns scan with findings", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getScanById, getFindingsByScanId } = await import("../db");
      vi.mocked(getScanById).mockResolvedValueOnce({
        id: "scan_123",
        userId: 1,
        scanType: "full",
        status: "completed",
        riskScore: "45",
        riskLevel: "MEDIUM",
        totalFindings: 2,
      });
      vi.mocked(getFindingsByScanId).mockResolvedValueOnce([
        { id: "f1", title: "Finding 1", severity: "Medium", status: "open" },
        { id: "f2", title: "Finding 2", severity: "High", status: "open" },
      ]);

      const result = await caller.scanning.getScan({ scanId: "scan_123" });

      expect(result.id).toBe("scan_123");
      expect(result.findings.length).toBe(2);
      expect(result.riskScore).toBe(45);
    });
  });

  describe("updateFindingStatus", () => {
    it("throws when user is not authenticated", async () => {
      const { ctx } = createNonAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scanning.updateFindingStatus({
          findingId: "f_123",
          status: "resolved",
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws when finding does not exist", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getFindingById } = await import("../db");
      vi.mocked(getFindingById).mockResolvedValueOnce(null);

      await expect(
        caller.scanning.updateFindingStatus({
          findingId: "nonexistent",
          status: "resolved",
        })
      ).rejects.toThrow("Finding not found");
    });

    it("throws when trying to update another user's finding", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getFindingById } = await import("../db");
      vi.mocked(getFindingById).mockResolvedValueOnce({
        id: "f_123",
        userId: 999, // Different user
        title: "Finding",
      });

      await expect(
        caller.scanning.updateFindingStatus({
          findingId: "f_123",
          status: "resolved",
        })
      ).rejects.toThrow("Finding not found");
    });

    it("successfully updates finding status to resolved", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getFindingById, updateFindingStatus } = await import("../db");
      vi.mocked(getFindingById).mockResolvedValueOnce({
        id: "f_123",
        userId: 1,
        title: "Finding",
      });

      const result = await caller.scanning.updateFindingStatus({
        findingId: "f_123",
        status: "resolved",
      });

      expect(result.success).toBe(true);
    });

    it("successfully updates finding status to in-progress", async () => {
      const { ctx } = createAuthContext(1, "editor");
      const caller = appRouter.createCaller(ctx);

      const { getFindingById } = await import("../db");
      vi.mocked(getFindingById).mockResolvedValueOnce({
        id: "f_123",
        userId: 1,
        title: "Finding",
      });

      const result = await caller.scanning.updateFindingStatus({
        findingId: "f_123",
        status: "in-progress",
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("scanning edge cases", () => {
  it("handles scan with empty collection data", async () => {
    const { ctx } = createAuthContext(1, "editor");
    const caller = appRouter.createCaller(ctx);

    const { getCollectionById } = await import("../db");
    vi.mocked(getCollectionById).mockResolvedValueOnce({
      id: "col_empty",
      userId: 1,
      name: "Empty Collection",
      data: { item: [] }, // Empty collection
    });

    const { runCollectionScan } = await import("../services/scanService");
    vi.mocked(runCollectionScan).mockResolvedValueOnce({
      scanId: "scan_empty",
      riskScore: 0,
      riskLevel: "LOW",
      totalFindings: 0,
      findings: [],
    } as any);

    const result = await caller.scanning.startScan({
      collectionId: "col_empty",
      scanType: "full",
    });

    expect(result).toBeDefined();
    expect(result.totalFindings).toBe(0);
  });

  it("handles Postman collection format", async () => {
    const { ctx } = createAuthContext(1, "editor");
    const caller = appRouter.createCaller(ctx);

    const { getCollectionById } = await import("../db");
    vi.mocked(getCollectionById).mockResolvedValueOnce({
      id: "col_postman",
      userId: 1,
      name: "Postman Collection",
      format: "postman",
      data: {
        item: [
          {
            name: "Get Users",
            request: {
              method: "GET",
              url: { raw: "https://api.example.com/users" },
              header: [],
            },
          },
          {
            name: "Create User",
            request: {
              method: "POST",
              url: { raw: "https://api.example.com/users" },
              header: [],
            },
          },
        ],
      },
    });

    const result = await caller.scanning.startScan({
      collectionId: "col_postman",
      scanType: "full",
    });

    expect(result).toBeDefined();
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  it("handles OpenAPI format", async () => {
    const { ctx } = createAuthContext(1, "editor");
    const caller = appRouter.createCaller(ctx);

    const { getCollectionById } = await import("../db");
    vi.mocked(getCollectionById).mockResolvedValueOnce({
      id: "col_openapi",
      userId: 1,
      name: "OpenAPI Spec",
      format: "openapi",
      data: {
        openapi: "3.0.0",
        paths: {
          "/users": {
            get: { summary: "Get users" },
            post: { summary: "Create user", security: [] },
          },
        },
      },
    });

    const result = await caller.scanning.startScan({
      collectionId: "col_openapi",
      scanType: "full",
    });

    expect(result).toBeDefined();
  });

  it("caps risk score at 100", async () => {
    const { ctx } = createAuthContext(1, "editor");
    const caller = appRouter.createCaller(ctx);

    const { getCollectionById } = await import("../db");
    // Collection with many vulnerabilities that would exceed 100
    vi.mocked(getCollectionById).mockResolvedValueOnce({
      id: "col_many",
      userId: 1,
      name: "Many Issues",
      data: {
        item: Array(20)
          .fill(null)
          .map((_, i) => ({
            request: {
              method: "POST",
              url: { raw: "http://api.example.com/users" },
              header: [],
            },
          })),
      },
    });

    const result = await caller.scanning.startScan({
      collectionId: "col_many",
      scanType: "full",
    });

    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});
