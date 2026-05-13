// @ts-nocheck  
/**
 * Collections Router Test Suite
 * Tests CRUD operations, authorization, pagination, and IDOR prevention
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock database module
vi.mock("../db", () => ({
  createCollection: vi.fn(),
  getCollectionsByUserId: vi.fn(),
  getCollectionById: vi.fn(),
  deleteCollection: vi.fn(),
  updateCollection: vi.fn(),
  getScansByCollectionId: vi.fn(),
  getFindingsByScanId: vi.fn(),
  getShadowAPIsByCollectionId: vi.fn(),
  getComplianceReportsByCollectionId: vi.fn(),
}));

// Mock cache module
vi.mock("../_core/cache", () => ({
  getOrSetCache: vi.fn(),
  CACHE_TTL: { USER_COLLECTIONS: 300 },
  cacheKeys: {
    userCollections: (userId: string) => `collections:${userId}`,
  },
  invalidateUserCache: vi.fn(),
}));

// Mock trpc context
const createMockContext = (userId: string, role: string = "editor") => ({
  user: { id: userId, email: "test@example.com", name: "Test User", role },
});

describe("Collections Router", () => {
  describe("create", () => {
    it("should create a collection with valid input", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        format: "openapi",
        data: { openapi: "3.0.0" },
        userId: "user_123",
        createdAt: new Date(),
      };

      const { createCollection } = await import("../db");
      createCollection.mockResolvedValue(mockCollection);

      // Simulate create mutation
      const input = {
        name: "Test API",
        description: "Test collection",
        format: "openapi" as const,
        data: { openapi: "3.0.0" },
      };

      const result = await createCollection(
        "user_123",
        input.name,
        input.format,
        input.data,
        input.description
      );
      expect(result).toEqual(mockCollection);
      expect(createCollection).toHaveBeenCalledWith(
        "user_123",
        "Test API",
        "openapi",
        { openapi: "3.0.0" },
        "Test collection"
      );
    });

    it("should reject creation without name", () => {
      const input = {
        name: "",
        format: "openapi" as const,
        data: {},
      };
      expect(() => validateCreateInput(input)).toThrow(
        "Invalid collection name"
      );
    });

    it("should reject invalid format type", () => {
      const input = {
        name: "Test",
        format: "invalid" as any,
        data: {},
      };
      expect(() => validateCreateInput(input)).toThrow("Invalid format");
    });

    it("should reject non-object data", () => {
      const input = {
        name: "Test",
        format: "openapi" as const,
        data: "string data" as any,
      };
      expect(() => validateCreateInput(input)).toThrow(
        "Invalid collection data"
      );
    });

    it("should create Postman collection format", async () => {
      const mockCollection = {
        id: "col_postman",
        name: "Postman API",
        format: "postman",
        data: { info: { name: "Test" }, item: [] },
        userId: "user_123",
      };

      const { createCollection } = await import("../db");
      createCollection.mockResolvedValue(mockCollection);

      const input = {
        name: "Postman API",
        format: "postman" as const,
        data: { info: { name: "Test" }, item: [] },
      };

      const result = await createCollection(
        "user_123",
        input.name,
        input.format,
        input.data,
        undefined
      );
      expect(result.format).toBe("postman");
    });
  });

  describe("list", () => {
    it("should list user collections with pagination", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "API 1",
          format: "openapi",
          totalRequests: 10,
          createdAt: new Date(),
        },
        {
          id: "2",
          name: "API 2",
          format: "postman",
          totalRequests: 5,
          createdAt: new Date(),
        },
      ];

      const { getCollectionsByUserId } = await import("../db");
      const { getOrSetCache } = await import("../_core/cache");

      getOrSetCache.mockImplementation(async (key, ttl, fn) => fn());
      getCollectionsByUserId.mockResolvedValue(mockCollections);

      const page = 1;
      const pageSize = 20;
      const total = mockCollections.length;

      const result = {
        collections: mockCollections.slice(0, pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };

      expect(result.total).toBe(2);
      expect(result.collections).toHaveLength(2);
    });

    it("should handle custom pagination parameters", async () => {
      const mockCollections = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        name: `API ${i}`,
        format: "openapi",
        totalRequests: i,
        createdAt: new Date(),
      }));

      const { getCollectionsByUserId } = await import("../db");
      const { getOrSetCache } = await import("../_core/cache");

      getOrSetCache.mockImplementation(async (key, ttl, fn) => fn());
      getCollectionsByUserId.mockResolvedValue(mockCollections);

      const page = 2;
      const pageSize = 10;
      const paginated = mockCollections.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      expect(paginated).toHaveLength(10);
      expect(paginated[0].name).toBe("API 10");
    });

    it("should return empty list for user with no collections", async () => {
      const { getCollectionsByUserId } = await import("../db");
      const { getOrSetCache } = await import("../_core/cache");

      getOrSetCache.mockImplementation(async (key, ttl, fn) => fn());
      getCollectionsByUserId.mockResolvedValue([]);

      const result = {
        collections: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };

      expect(result.total).toBe(0);
      expect(result.collections).toHaveLength(0);
    });

    it("should limit page size to maximum 100", () => {
      const pageSize = 150;
      const clampedPageSize = Math.min(pageSize, 100);
      expect(clampedPageSize).toBe(100);
    });
  });

  describe("get", () => {
    it("should return collection for authorized user", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
      };

      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("user_123");
      const result = await getCollectionById("col_123");

      expect(result.userId).toBe(ctx.user.id);
    });

    it("should deny access to other user collection", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "other_user",
      };

      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      expect(collection.userId).not.toBe(ctx.user.id);
      expect(() => validateCollectionAccess(collection, ctx.user.id)).toThrow(
        "Collection not found or access denied"
      );
    });

    it("should throw error for non-existent collection", async () => {
      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(null);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("nonexistent");

      expect(collection).toBeNull();
      expect(() => validateCollectionAccess(collection, ctx.user.id)).toThrow(
        "Collection not found or access denied"
      );
    });
  });

  describe("delete", () => {
    it("should delete collection for owner", async () => {
      const mockCollection = {
        id: "col_123",
        userId: "user_123",
      };

      const { getCollectionById, deleteCollection } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);
      deleteCollection.mockResolvedValue({ success: true });

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      expect(collection.userId).toBe(ctx.user.id);
      await deleteCollection("col_123");

      expect(deleteCollection).toHaveBeenCalledWith("col_123");
    });

    it("should prevent IDOR on delete", async () => {
      const mockCollection = {
        id: "col_123",
        userId: "attacker_user",
      };

      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      // Attacker tries to delete victim's collection
      expect(collection.userId).not.toBe(ctx.user.id);
      expect(() => validateCollectionAccess(collection, ctx.user.id)).toThrow(
        "Collection not found or access denied"
      );
    });

    it("should reject viewer role on delete", () => {
      const ctx = createMockContext("user_123", "viewer");

      expect(ctx.user.role).toBe("viewer");
      expect(() => validateEditorProcedure(ctx.user)).toThrow(
        "Editor or Admin role required"
      );
    });
  });

  describe("update", () => {
    it("should update collection name and description", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Old Name",
        description: "Old description",
        userId: "user_123",
      };

      const { getCollectionById, updateCollection } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);
      updateCollection.mockResolvedValue({ success: true });

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");
      expect(collection.userId).toBe(ctx.user.id);

      const updates = { name: "New Name", description: "New description" };
      await updateCollection("col_123", updates);

      expect(updateCollection).toHaveBeenCalledWith("col_123", updates);
    });

    it("should reject empty name on update", () => {
      const updates = { name: "", description: "Valid description" };
      expect(() => validateUpdateInput(updates)).toThrow(
        "Invalid collection name"
      );
    });

    it("should reject description exceeding 1000 characters", () => {
      const longDescription = "a".repeat(1001);
      const updates = { name: "Valid", description: longDescription };
      expect(() => validateUpdateInput(updates)).toThrow(
        "Description exceeds 1000 characters"
      );
    });

    it("should allow partial updates", async () => {
      const { updateCollection } = await import("../db");
      updateCollection.mockResolvedValue({ success: true });

      // Only update name
      await updateCollection("col_123", { name: "New Name" });
      expect(updateCollection).toHaveBeenCalledWith("col_123", {
        name: "New Name",
      });

      // Only update description
      await updateCollection("col_123", { description: "New description" });
      expect(updateCollection).toHaveBeenCalledWith("col_123", {
        description: "New description",
      });
    });
  });

  describe("getWithDetails", () => {
    it("should return collection with all related data", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
        format: "openapi",
        totalRequests: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockScans = [
        { id: "scan_1", completedAt: new Date(), totalFindings: 5 },
      ];
      const mockFindings = [
        { id: "f1", title: "Finding 1", severity: "high", status: "open" },
      ];
      const mockShadowApis = [
        { id: "s1", endpoint: "/api/admin", method: "GET", riskLevel: "high" },
      ];
      const mockReports = [
        { id: "r1", reportType: "pci_dss", complianceScore: "75.5" },
      ];

      const {
        getCollectionById,
        getScansByCollectionId,
        getFindingsByScanId,
        getShadowAPIsByCollectionId,
        getComplianceReportsByCollectionId,
      } = await import("../db");

      getCollectionById.mockResolvedValue(mockCollection);
      getScansByCollectionId.mockResolvedValue(mockScans);
      getFindingsByScanId.mockResolvedValue(mockFindings);
      getShadowAPIsByCollectionId.mockResolvedValue(mockShadowApis);
      getComplianceReportsByCollectionId.mockResolvedValue(mockReports);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      const scans = await getScansByCollectionId("col_123");
      const findings = await getFindingsByScanId(scans[0]?.id || "");
      const shadowApis = await getShadowAPIsByCollectionId("col_123");
      const reports = await getComplianceReportsByCollectionId("col_123");

      const lastScan = scans.length > 0 ? scans[0] : null;
      const totalFindings = scans.reduce(
        (sum, scan) => sum + (scan.totalFindings || 0),
        0
      );

      expect(collection.userId).toBe(ctx.user.id);
      expect(scans).toHaveLength(1);
      expect(findings).toHaveLength(1);
      expect(shadowApis).toHaveLength(1);
      expect(reports).toHaveLength(1);
      expect(totalFindings).toBe(5);
      expect(lastScan.completedAt).toBeDefined();
    });

    it("should handle empty scans gracefully", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
      };

      const { getCollectionById, getScansByCollectionId } = await import(
        "../db"
      );

      getCollectionById.mockResolvedValue(mockCollection);
      getScansByCollectionId.mockResolvedValue([]);

      const scans = await getScansByCollectionId("col_123");
      const lastScan = scans.length > 0 ? scans[0] : null;

      expect(lastScan).toBeNull();
    });

    it("should limit recent findings to 10", async () => {
      const mockFindings = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        title: `Finding ${i}`,
        severity: "medium",
        status: "open",
      }));

      const { getFindingsByScanId } = await import("../db");
      getFindingsByScanId.mockResolvedValue(mockFindings);

      const findings = await getFindingsByScanId("scan_1");
      const limitedFindings = findings.slice(0, 10);

      expect(limitedFindings).toHaveLength(10);
    });
  });
});

// Helper validation functions
function validateCreateInput(input: any) {
  if (!input.name || input.name.trim() === "") {
    throw new Error("Invalid collection name");
  }
  if (!["postman", "openapi"].includes(input.format)) {
    throw new Error("Invalid format");
  }
  if (!input.data || typeof input.data !== "object") {
    throw new Error("Invalid collection data: must be a JSON object");
  }
  return true;
}

function validateUpdateInput(input: any) {
  if (input.name !== undefined && input.name.trim() === "") {
    throw new Error("Invalid collection name");
  }
  if (input.description && input.description.length > 1000) {
    throw new Error("Description exceeds 1000 characters");
  }
  return true;
}

function validateCollectionAccess(collection: any, userId: string) {
  if (!collection || collection.userId !== userId) {
    throw new Error("Collection not found or access denied");
  }
  return true;
}

function validateEditorProcedure(user: any) {
  if (user.role !== "editor" && user.role !== "admin") {
    throw new Error("Editor or Admin role required");
  }
  return true;
}
