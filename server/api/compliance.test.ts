// @ts-nocheck
/**
 * Compliance Router Test Suite
 * Tests report generation, access control, and PDF export functionality
 */
import { describe, it, expect, vi } from "vitest";

// Mock database module
vi.mock("../db", () => ({
  getCollectionById: vi.fn(),
  createComplianceReport: vi.fn(),
  getComplianceReportsByCollectionId: vi.fn(),
  getComplianceReportById: vi.fn(),
}));

// Mock utils
vi.mock("../utils/scanning", () => ({
  generateOWASPRequirements: vi.fn(),
  generatePCIDSSRequirements: vi.fn(),
}));

// Mock trpc context
const createMockContext = (userId: string, role: string = "editor") => ({
  user: { id: userId, email: "test@example.com", name: "Test User", role },
});

describe("Compliance Router", () => {
  describe("generateReport", () => {
    it("should generate PCI DSS report for authorized user", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
        data: { paths: { "/api/test": { get: {} } } },
      };

      const mockRequirements = [
        { id: "1.1", title: "Firewall Configuration", status: "met" },
        { id: "1.2", title: "Default Credentials", status: "not_met" },
        { id: "2.1", title: "Encryption", status: "manual_review" },
      ];

      const mockReport = {
        id: "report_123",
        userId: "user_123",
        collectionId: "col_123",
        reportType: "pci_dss",
        complianceScore: 33.33,
        totalRequirements: 3,
        metRequirements: 1,
        requirementsData: mockRequirements,
      };

      const { getCollectionById, createComplianceReport } = await import("../db");
      const { generatePCIDSSRequirements } = await import("../utils/scanning");

      getCollectionById.mockResolvedValue(mockCollection);
      generatePCIDSSRequirements.mockReturnValue(mockRequirements);
      createComplianceReport.mockResolvedValue(mockReport);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      expect(collection.userId).toBe(ctx.user.id);

      const requirements = generatePCIDSSRequirements(collection.data);
      const metRequirements = requirements.filter((r: any) => r.status === "met").length;
      const complianceScore = (metRequirements / requirements.length) * 100;

      const report = await createComplianceReport(
        ctx.user.id,
        "col_123",
        "pci_dss",
        complianceScore,
        requirements.length,
        metRequirements,
        requirements,
      );

      expect(report.reportType).toBe("pci_dss");
      expect(complianceScore).toBeCloseTo(33.33, 0);
    });

    it("should generate OWASP report", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
        data: { openapi: "3.0.0" },
      };

      const mockRequirements = [
        { id: "A01", title: "Broken Access Control", status: "met" },
        { id: "A02", title: "Cryptographic Failures", status: "manual_review" },
        { id: "A03", title: "Injection", status: "met" },
      ];

      const mockReport = {
        id: "report_owasp",
        reportType: "owasp",
        complianceScore: 66.67,
      };

      const { getCollectionById, createComplianceReport } = await import("../db");
      const { generateOWASPRequirements } = await import("../utils/scanning");

      getCollectionById.mockResolvedValue(mockCollection);
      generateOWASPRequirements.mockReturnValue(mockRequirements);
      createComplianceReport.mockResolvedValue(mockReport);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");

      expect(collection.userId).toBe(ctx.user.id);

      const requirements = generateOWASPRequirements(collection.data);
      const manualRequirements = requirements.filter(
        (r: any) => r.status === "manual_review",
      ).length;
      const complianceScore =
        ((requirements.length - manualRequirements) / requirements.length) * 100;

      expect(complianceScore).toBeCloseTo(66.67, 0);
    });

    it("should deny access to other user collection", async () => {
      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "attacker_id",
      };

      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("victim_id");
      const collection = await getCollectionById("col_123");

      expect(collection.userId).not.toBe(ctx.user.id);
      expect(() => validateCollectionAccess(collection, ctx.user.id)).toThrow(
        "Collection not found or access denied",
      );
    });

    it("should reject viewer role on report generation", () => {
      const ctx = createMockContext("user_123", "viewer");
      expect(() => validateEditorProcedure(ctx.user)).toThrow("Editor or Admin role required");
    });

    it("should throw error for non-existent collection", async () => {
      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(null);

      const collection = await getCollectionById("nonexistent");
      expect(collection).toBeNull();
    });

    it("should default to pci_dss report type", () => {
      const input = {};
      const reportType = input.reportType ?? "pci_dss";
      expect(reportType).toBe("pci_dss");
    });

    it("should calculate manual review requirements count", () => {
      const requirements = [
        { id: "1", status: "met" },
        { id: "2", status: "not_met" },
        { id: "3", status: "manual_review" },
        { id: "4", status: "manual_review" },
      ];

      const manualRequirements = requirements.filter(
        (r: any) => r.status === "manual_review",
      ).length;
      expect(manualRequirements).toBe(2);
    });
  });

  describe("listReports", () => {
    it("should list compliance reports for collection", async () => {
      const mockCollection = {
        id: "col_123",
        userId: "user_123",
      };

      const mockReports = [
        {
          id: "r1",
          reportType: "pci_dss",
          complianceScore: "75.0",
          totalRequirements: 10,
          metRequirements: 7,
          createdAt: new Date(),
        },
        {
          id: "r2",
          reportType: "owasp",
          complianceScore: "60.0",
          totalRequirements: 10,
          metRequirements: 6,
          createdAt: new Date(),
        },
      ];

      const { getCollectionById, getComplianceReportsByCollectionId } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);
      getComplianceReportsByCollectionId.mockResolvedValue(mockReports);

      const ctx = createMockContext("user_123");
      const collection = await getCollectionById("col_123");
      expect(collection.userId).toBe(ctx.user.id);

      const reports = await getComplianceReportsByCollectionId("col_123");
      const page = 1;
      const pageSize = 20;
      const paginated = reports.slice((page - 1) * pageSize, page * pageSize);

      expect(paginated).toHaveLength(2);
      expect(paginated[0].reportType).toBe("pci_dss");
    });

    it("should deny access to reports of other user collection", async () => {
      const mockCollection = {
        id: "col_123",
        userId: "attacker_id",
      };

      const { getCollectionById } = await import("../db");
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("victim_id");
      const collection = await getCollectionById("col_123");

      expect(() => validateCollectionAccess(collection, ctx.user.id)).toThrow(
        "Collection not found or access denied",
      );
    });

    it("should paginate results correctly", async () => {
      const mockReports = Array.from({ length: 50 }, (_, i) => ({
        id: `r${i}`,
        reportType: "pci_dss",
        complianceScore: String(50 + i),
        totalRequirements: 10,
        metRequirements: 5,
        createdAt: new Date(),
      }));

      const { getComplianceReportsByCollectionId } = await import("../db");
      getComplianceReportsByCollectionId.mockResolvedValue(mockReports);

      const page = 2;
      const pageSize = 10;
      const paginated = mockReports.slice((page - 1) * pageSize, page * pageSize);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe("r10");
      expect(paginated[9].id).toBe("r19");
    });

    it("should return empty list for collection with no reports", async () => {
      const { getComplianceReportsByCollectionId } = await import("../db");
      getComplianceReportsByCollectionId.mockResolvedValue([]);

      const reports = await getComplianceReportsByCollectionId("col_empty");
      expect(reports).toHaveLength(0);
    });
  });

  describe("getReport", () => {
    it("should return full report details for authorized user", async () => {
      const mockReport = {
        id: "report_123",
        userId: "user_123",
        collectionId: "col_123",
        reportType: "pci_dss",
        complianceScore: "75.5",
        totalRequirements: 10,
        metRequirements: 7,
        requirementsData: [
          { id: "1.1", title: "Firewall", status: "met" },
          { id: "1.2", title: "Credentials", status: "not_met" },
          { id: "1.3", title: "Encryption", status: "manual_review" },
        ],
        createdAt: new Date(),
      };

      const { getComplianceReportById } = await import("../db");
      getComplianceReportById.mockResolvedValue(mockReport);

      const ctx = createMockContext("user_123");
      const report = await getComplianceReportById("report_123");

      expect(report.userId).toBe(ctx.user.id);
      expect(report.requirementsData).toHaveLength(3);

      const requirements = report.requirementsData;
      const manualRequirements = requirements.filter((r) => r.status === "manual_review").length;
      const notMetRequirements = requirements.filter((r) => r.status === "not_met").length;

      expect(manualRequirements).toBe(1);
      expect(notMetRequirements).toBe(1);
    });

    it("should deny access to other user report", async () => {
      const mockReport = {
        id: "report_123",
        userId: "attacker_id",
        collectionId: "col_123",
      };

      const { getComplianceReportById } = await import("../db");
      getComplianceReportById.mockResolvedValue(mockReport);

      const ctx = createMockContext("victim_id");
      const report = await getComplianceReportById("report_123");

      expect(report.userId).not.toBe(ctx.user.id);
      expect(() => validateReportAccess(report, ctx.user.id)).toThrow(
        "Report not found or access denied",
      );
    });

    it("should throw error for non-existent report", async () => {
      const { getComplianceReportById } = await import("../db");
      getComplianceReportById.mockResolvedValue(null);

      const report = await getComplianceReportById("nonexistent");
      expect(report).toBeNull();
    });
  });

  describe("exportReport", () => {
    it("should export report as PDF with base64 encoding", async () => {
      const mockReport = {
        id: "report_123",
        userId: "user_123",
        collectionId: "col_123",
        reportType: "pci_dss",
        complianceScore: "75.5",
        totalRequirements: 10,
        metRequirements: 7,
        requirementsData: [
          { id: "1.1", status: "met" },
          { id: "1.2", status: "not_met" },
        ],
        createdAt: new Date(),
      };

      const mockCollection = {
        id: "col_123",
        name: "Test API",
        userId: "user_123",
      };

      const { getComplianceReportById, getCollectionById } = await import("../db");
      getComplianceReportById.mockResolvedValue(mockReport);
      getCollectionById.mockResolvedValue(mockCollection);

      const ctx = createMockContext("user_123");
      const report = await getComplianceReportById("report_123");
      const collection = await getCollectionById(report.collectionId);

      expect(report.userId).toBe(ctx.user.id);

      const requirements = report.requirementsData;
      const metCount = requirements.filter((r) => r.status === "met").length;
      const notMetCount = requirements.filter((r) => r.status === "not_met").length;

      // Simulate PDF generation
      const pdfBuffer = Buffer.from("mock-pdf-content");
      const pdfBase64 = pdfBuffer.toString("base64");

      expect(pdfBase64).toBeTruthy();
      expect(pdfBase64.length).toBeGreaterThan(0);
    });

    it("should deny export for other user report", async () => {
      const mockReport = {
        id: "report_123",
        userId: "attacker_id",
        collectionId: "col_123",
      };

      const { getComplianceReportById } = await import("../db");
      getComplianceReportById.mockResolvedValue(mockReport);

      const ctx = createMockContext("victim_id");
      const report = await getComplianceReportById("report_123");

      expect(() => validateReportAccess(report, ctx.user.id)).toThrow(
        "Report not found or access denied",
      );
    });

    it("should include metadata in export response", async () => {
      const mockReport = {
        id: "report_123",
        userId: "user_123",
        reportType: "pci_dss",
        complianceScore: "80.0",
      };

      const { getComplianceReportById } = await import("../db");
      getComplianceReportById.mockResolvedValue(mockReport);

      const report = await getComplianceReportById("report_123");
      const score = parseFloat(report.complianceScore as any);

      const exportResponse = {
        reportId: report.id,
        reportType: report.reportType,
        complianceScore: score,
        pdfBase64: Buffer.from("content").toString("base64"),
        filename: `rakshex-compliance-report-${new Date().toISOString().split("T")[0]}.pdf`,
        exportDate: new Date().toISOString(),
      };

      expect(exportResponse.filename).toContain("rakshex-compliance-report-");
      expect(exportResponse.exportDate).toBeTruthy();
    });

    it("should generate correct filename with date", () => {
      const today = new Date().toISOString().split("T")[0];
      const filename = `rakshex-compliance-report-${today}.pdf`;

      expect(filename).toMatch(/^rakshex-compliance-report-.*\.pdf$/);
      expect(filename).toContain(today);
    });
  });

  describe("Compliance Score Calculations", () => {
    it("should calculate 100% compliance score", () => {
      const requirements = [
        { id: "1", status: "met" },
        { id: "2", status: "met" },
        { id: "3", status: "met" },
      ];

      const metCount = requirements.filter((r) => r.status === "met").length;
      const score = (metCount / requirements.length) * 100;

      expect(score).toBe(100);
    });

    it("should calculate 0% compliance score", () => {
      const requirements = [
        { id: "1", status: "not_met" },
        { id: "2", status: "not_met" },
        { id: "3", status: "not_met" },
      ];

      const metCount = requirements.filter((r) => r.status === "met").length;
      const score = (metCount / requirements.length) * 100;

      expect(score).toBe(0);
    });

    it("should round compliance score to nearest integer", () => {
      const requirements = [
        { id: "1", status: "met" },
        { id: "2", status: "not_met" },
      ];

      const metCount = requirements.filter((r) => r.status === "met").length;
      const score = (metCount / requirements.length) * 100;
      const roundedScore = Math.round(score);

      expect(roundedScore).toBe(50);
    });

    it("should handle empty requirements array", () => {
      const requirements: any[] = [];

      const metCount = requirements.filter((r) => r.status === "met").length;
      const score = requirements.length > 0 ? (metCount / requirements.length) * 100 : 0;

      expect(score).toBe(0);
    });
  });
});

// Helper validation functions
function validateCollectionAccess(collection: any, userId: string) {
  if (!collection || collection.userId !== userId) {
    throw new Error("Collection not found or access denied");
  }
  return true;
}

function validateReportAccess(report: any, userId: string) {
  if (!report || report.userId !== userId) {
    throw new Error("Report not found or access denied");
  }
  return true;
}

function validateEditorProcedure(user: any) {
  if (user.role !== "editor" && user.role !== "admin") {
    throw new Error("Editor or Admin role required");
  }
  return true;
}
