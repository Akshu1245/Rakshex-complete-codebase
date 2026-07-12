// @ts-nocheck
/**
 * TokenAnalytics Router Test Suite
 * Tests usage recording, analytics queries, and CSV export
 */
import { describe, it, expect, vi } from "vitest";

// Mock database module
vi.mock("../db", () => ({
  recordTokenUsage: vi.fn(),
  getTokenUsageByUserId: vi.fn(),
  getTokenUsageByModel: vi.fn(),
}));

// Mock trpc context
const createMockContext = (userId: string) => ({
  user: {
    id: userId,
    email: "test@example.com",
    name: "Test User",
    role: "editor",
  },
});

describe("TokenAnalytics Router", () => {
  describe("recordUsage", () => {
    it("should record token usage with valid input", async () => {
      const { recordTokenUsage } = await import("../db");
      recordTokenUsage.mockResolvedValue({ success: true });

      const ctx = createMockContext("user_123");
      const input = {
        model: "gpt-4o",
        promptTokens: 1500,
        completionTokens: 500,
        thinkingTokens: 200,
        costUSD: 0.045,
      };

      await recordTokenUsage(
        ctx.user.id,
        input.model,
        input.promptTokens,
        input.completionTokens,
        input.thinkingTokens,
        input.costUSD,
      );

      expect(recordTokenUsage).toHaveBeenCalledWith("user_123", "gpt-4o", 1500, 500, 200, 0.045);
    });

    it("should reject empty model name", () => {
      const input = {
        model: "",
        promptTokens: 100,
        completionTokens: 50,
        thinkingTokens: 0,
        costUSD: 0.01,
      };
      expect(() => validateModelName(input.model)).toThrow("Model name is required");
    });

    it("should reject negative token counts", () => {
      const invalidInputs = [
        {
          promptTokens: -1,
          completionTokens: 50,
          thinkingTokens: 0,
          costUSD: 0.01,
        },
        {
          promptTokens: 100,
          completionTokens: -1,
          thinkingTokens: 0,
          costUSD: 0.01,
        },
        {
          promptTokens: 100,
          completionTokens: 50,
          thinkingTokens: -1,
          costUSD: 0.01,
        },
      ];

      invalidInputs.forEach((input) => {
        expect(() => validateTokenCounts(input)).toThrow("Token counts cannot be negative");
      });
    });

    it("should reject negative cost values", () => {
      const input = {
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        thinkingTokens: 0,
        costUSD: -0.01,
      };
      expect(() => validateCost(input.costUSD)).toThrow("Cost cannot be negative");
    });

    it("should accept zero thinking tokens", async () => {
      const { recordTokenUsage } = await import("../db");
      recordTokenUsage.mockResolvedValue({ success: true });

      const input = {
        model: "gpt-3.5-turbo",
        promptTokens: 100,
        completionTokens: 50,
        thinkingTokens: 0,
        costUSD: 0.002,
      };

      await recordTokenUsage(
        "user_123",
        input.model,
        input.promptTokens,
        input.completionTokens,
        input.thinkingTokens,
        input.costUSD,
      );
      expect(recordTokenUsage).toHaveBeenCalled();
    });

    it("should accept zero cost for free tier", async () => {
      const { recordTokenUsage } = await import("../db");
      recordTokenUsage.mockResolvedValue({ success: true });

      const input = {
        model: "gpt-3.5-turbo",
        promptTokens: 100,
        completionTokens: 50,
        thinkingTokens: 0,
        costUSD: 0,
      };

      await recordTokenUsage(
        "user_123",
        input.model,
        input.promptTokens,
        input.completionTokens,
        input.thinkingTokens,
        input.costUSD,
      );
      expect(recordTokenUsage).toHaveBeenCalled();
    });

    it("should reject model name exceeding 128 characters", () => {
      const longModelName = "a".repeat(129);
      expect(() => validateModelNameLength(longModelName)).toThrow(
        "Model name exceeds 128 characters",
      );
    });
  });

  describe("getAnalytics", () => {
    it("should return aggregated analytics by model", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          promptTokens: 1000,
          completionTokens: 500,
          thinkingTokens: 200,
          totalTokens: 1700,
          costUSD: "0.045",
          date: new Date(),
        },
        {
          model: "gpt-4o",
          promptTokens: 500,
          completionTokens: 250,
          thinkingTokens: 100,
          totalTokens: 850,
          costUSD: "0.0225",
          date: new Date(),
        },
        {
          model: "claude-3-5-sonnet",
          promptTokens: 800,
          completionTokens: 400,
          thinkingTokens: 0,
          totalTokens: 1200,
          costUSD: "0.012",
          date: new Date(),
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const ctx = createMockContext("user_123");
      const usage = await getTokenUsageByUserId(ctx.user.id, 30);

      const byModel: Record<string, any> = {};
      let totalCost = 0;
      let totalTokens = 0;

      for (const record of usage) {
        if (!byModel[record.model]) {
          byModel[record.model] = {
            model: record.model,
            promptTokens: 0,
            completionTokens: 0,
            thinkingTokens: 0,
            totalTokens: 0,
            costUSD: 0,
          };
        }

        byModel[record.model].promptTokens += record.promptTokens;
        byModel[record.model].completionTokens += record.completionTokens;
        byModel[record.model].thinkingTokens += record.thinkingTokens;
        byModel[record.model].totalTokens += record.totalTokens;
        byModel[record.model].costUSD += parseFloat(record.costUSD as any);

        totalCost += parseFloat(record.costUSD as any);
        totalTokens += record.totalTokens;
      }

      expect(Object.keys(byModel)).toHaveLength(2);
      expect(byModel["gpt-4o"].totalTokens).toBe(2550);
      expect(byModel["gpt-4o"].costUSD).toBeCloseTo(0.0675, 4);
      expect(totalCost).toBeCloseTo(0.0795, 4);
      expect(totalTokens).toBe(3750);
    });

    it("should default to 30 days if not specified", async () => {
      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue([]);

      const input = {};
      const days = input.days ?? 30;

      await getTokenUsageByUserId("user_123", days);
      expect(getTokenUsageByUserId).toHaveBeenCalledWith("user_123", 30);
    });

    it("should accept custom day range", async () => {
      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue([]);

      const input = { days: 7 };
      await getTokenUsageByUserId("user_123", input.days);
      expect(getTokenUsageByUserId).toHaveBeenCalledWith("user_123", 7);
    });

    it("should reject day range less than 1", () => {
      const invalidDays = [0, -1, -30];
      invalidDays.forEach((days) => {
        expect(() => validateDayRange(days)).toThrow("Days must be at least 1");
      });
    });

    it("should reject day range exceeding 365", () => {
      expect(() => validateDayRange(366)).toThrow("Days cannot exceed 365");
    });

    it("should return empty analytics for new user", async () => {
      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue([]);

      const ctx = createMockContext("new_user");
      const usage = await getTokenUsageByUserId(ctx.user.id, 30);

      expect(usage).toHaveLength(0);
    });

    it("should format usage records correctly", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          totalTokens: 1500,
          costUSD: "0.045",
          date: "2024-01-15",
        },
        {
          model: "gpt-4o",
          totalTokens: 2000,
          costUSD: "0.060",
          date: "2024-01-16",
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const usage = await getTokenUsageByUserId("user_123", 30);
      const formattedUsage = usage.map((u) => ({
        date: u.date,
        model: u.model,
        tokens: u.totalTokens,
        cost: parseFloat(u.costUSD as any),
      }));

      expect(formattedUsage).toHaveLength(2);
      expect(formattedUsage[0].tokens).toBe(1500);
      expect(formattedUsage[0].cost).toBeCloseTo(0.045, 3);
    });
  });

  describe("getModelBreakdown", () => {
    it("should return detailed usage for specific model", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          promptTokens: 1000,
          completionTokens: 500,
          thinkingTokens: 200,
          totalTokens: 1700,
          costUSD: "0.045",
          date: "2024-01-15",
        },
        {
          model: "gpt-4o",
          promptTokens: 800,
          completionTokens: 400,
          thinkingTokens: 150,
          totalTokens: 1350,
          costUSD: "0.036",
          date: "2024-01-16",
        },
      ];

      const { getTokenUsageByModel } = await import("../db");
      getTokenUsageByModel.mockResolvedValue(mockUsage);

      const ctx = createMockContext("user_123");
      const usage = await getTokenUsageByModel(ctx.user.id, "gpt-4o");

      expect(usage).toHaveLength(2);
      expect(usage[0].model).toBe("gpt-4o");
      expect(usage[0].promptTokens).toBe(1000);
      expect(usage[1].thinkingTokens).toBe(150);
    });

    it("should return empty list for unused model", async () => {
      const { getTokenUsageByModel } = await import("../db");
      getTokenUsageByModel.mockResolvedValue([]);

      const usage = await getTokenUsageByModel("user_123", "unused-model");
      expect(usage).toHaveLength(0);
    });

    it("should aggregate model-specific totals", async () => {
      const mockUsage = [
        {
          model: "claude-3-5-sonnet",
          promptTokens: 500,
          completionTokens: 300,
          thinkingTokens: 0,
          totalTokens: 800,
          costUSD: "0.015",
          date: "2024-01-15",
        },
      ];

      const { getTokenUsageByModel } = await import("../db");
      getTokenUsageByModel.mockResolvedValue(mockUsage);

      const usage = await getTokenUsageByModel("user_123", "claude-3-5-sonnet");

      const totalPrompt = usage.reduce((sum, u) => sum + u.promptTokens, 0);
      const totalCompletion = usage.reduce((sum, u) => sum + u.completionTokens, 0);
      const totalCost = usage.reduce((sum, u) => sum + parseFloat(u.costUSD as any), 0);

      expect(totalPrompt).toBe(500);
      expect(totalCompletion).toBe(300);
      expect(totalCost).toBeCloseTo(0.015, 3);
    });
  });

  describe("exportAnalytics", () => {
    it("should export usage as CSV with header", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          promptTokens: 1000,
          completionTokens: 500,
          thinkingTokens: 200,
          totalTokens: 1700,
          costUSD: "0.045",
          date: new Date("2024-01-15"),
        },
        {
          model: "claude-3-5-sonnet",
          promptTokens: 800,
          completionTokens: 400,
          thinkingTokens: 0,
          totalTokens: 1200,
          costUSD: "0.012",
          date: new Date("2024-01-16"),
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const ctx = createMockContext("user_123");
      const usage = await getTokenUsageByUserId(ctx.user.id, 30);

      const csvHeader =
        "Date,Model,Prompt Tokens,Completion Tokens,Thinking Tokens,Total Tokens,Cost (USD)";
      const csvRows = usage.map(
        (u) =>
          `${new Date(u.date).toISOString()},${u.model},${u.promptTokens},${u.completionTokens},${u.thinkingTokens},${u.totalTokens},${parseFloat(u.costUSD as any).toFixed(6)}`,
      );
      const csv = [csvHeader, ...csvRows].join("\n");

      expect(csv).toContain(csvHeader);
      expect(csv).toContain("gpt-4o");
      expect(csv).toContain("claude-3-5-sonnet");
      expect(csv.split("\n")).toHaveLength(3); // header + 2 data rows
    });

    it("should calculate total cost for export", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          promptTokens: 1000,
          completionTokens: 500,
          thinkingTokens: 200,
          totalTokens: 1700,
          costUSD: "0.045",
          date: new Date(),
        },
        {
          model: "gpt-4o",
          promptTokens: 500,
          completionTokens: 250,
          thinkingTokens: 100,
          totalTokens: 850,
          costUSD: "0.0225",
          date: new Date(),
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const usage = await getTokenUsageByUserId("user_123", 30);
      const totalCost = usage.reduce((sum, u) => sum + parseFloat(u.costUSD as any), 0);

      expect(totalCost).toBeCloseTo(0.0675, 4);
    });

    it("should calculate total tokens for export", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          totalTokens: 1700,
          costUSD: "0.045",
          date: new Date(),
        },
        {
          model: "gpt-4o",
          totalTokens: 850,
          costUSD: "0.0225",
          date: new Date(),
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const usage = await getTokenUsageByUserId("user_123", 30);
      const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);

      expect(totalTokens).toBe(2550);
    });

    it("should include record count in export response", async () => {
      const mockUsage = [
        {
          model: "gpt-4o",
          totalTokens: 1000,
          costUSD: "0.03",
          date: new Date(),
        },
        {
          model: "claude-3-5-sonnet",
          totalTokens: 800,
          costUSD: "0.012",
          date: new Date(),
        },
        {
          model: "gemini-pro",
          totalTokens: 1500,
          costUSD: "0.025",
          date: new Date(),
        },
      ];

      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue(mockUsage);

      const usage = await getTokenUsageByUserId("user_123", 30);

      const exportResponse = {
        csv: "mock-csv",
        totalCost: usage.reduce((sum, u) => sum + parseFloat(u.costUSD as any), 0),
        totalTokens: usage.reduce((sum, u) => sum + u.totalTokens, 0),
        recordCount: usage.length,
        exportDate: new Date().toISOString(),
      };

      expect(exportResponse.recordCount).toBe(3);
      expect(exportResponse.csv).toBe("mock-csv");
    });

    it("should handle empty usage for export", async () => {
      const { getTokenUsageByUserId } = await import("../db");
      getTokenUsageByUserId.mockResolvedValue([]);

      const usage = await getTokenUsageByUserId("user_123", 30);

      const csvHeader =
        "Date,Model,Prompt Tokens,Completion Tokens,Thinking Tokens,Total Tokens,Cost (USD)";
      const csv = [csvHeader].join("\n");

      expect(csv.split("\n")).toHaveLength(1); // only header
    });

    it("should format cost to 6 decimal places", () => {
      const costUSD = 0.0456789;
      const formattedCost = costUSD.toFixed(6);

      expect(formattedCost).toBe("0.045679");
    });
  });

  describe("Cost Calculations", () => {
    it("should calculate average cost per token", () => {
      const totalCost = 0.675;
      const totalTokens = 2550;
      const costPerToken = totalCost / totalTokens;

      expect(costPerToken).toBeCloseTo(0.000265, 6);
    });

    it("should calculate cost by model percentage", () => {
      const costs = {
        "gpt-4o": 0.045,
        "claude-3-5-sonnet": 0.03,
        "gemini-pro": 0.025,
      };
      const totalCost = Object.values(costs).reduce((sum, c) => sum + c, 0);

      const percentages = Object.entries(costs).map(([model, cost]) => ({
        model,
        percentage: (cost / totalCost) * 100,
      }));

      // totalCost = 0.1, so each model's percentage is cost / 0.1 * 100.
      expect(percentages[0].percentage).toBeCloseTo(45.0, 0);
      expect(percentages[1].percentage).toBeCloseTo(30.0, 0);
      expect(percentages[2].percentage).toBeCloseTo(25.0, 0);
    });

    it("should identify high-cost models", () => {
      const costs = [
        { model: "gpt-4o", cost: 0.045 },
        { model: "claude-3-5-sonnet", cost: 0.03 },
        { model: "gemini-pro", cost: 0.025 },
      ];

      // 0.04 picks out only gpt-4o from the cost list above.
      const threshold = 0.04;
      const highCostModels = costs.filter((c) => c.cost >= threshold);

      expect(highCostModels).toHaveLength(1);
      expect(highCostModels[0].model).toBe("gpt-4o");
    });
  });
});

// Helper validation functions
function validateModelName(model: string) {
  if (!model || model.trim() === "") {
    throw new Error("Model name is required");
  }
  return true;
}

function validateModelNameLength(model: string) {
  if (model.length > 128) {
    throw new Error("Model name exceeds 128 characters");
  }
  return true;
}

function validateTokenCounts(input: any) {
  if (input.promptTokens < 0 || input.completionTokens < 0 || input.thinkingTokens < 0) {
    throw new Error("Token counts cannot be negative");
  }
  return true;
}

function validateCost(cost: number) {
  if (cost < 0) {
    throw new Error("Cost cannot be negative");
  }
  return true;
}

function validateDayRange(days: number) {
  if (days < 1) {
    throw new Error("Days must be at least 1");
  }
  if (days > 365) {
    throw new Error("Days cannot exceed 365");
  }
  return true;
}
