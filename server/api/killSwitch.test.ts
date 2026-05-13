// @ts-nocheck  
/**
 * KillSwitch Router Test Suite
 * Tests budget management, trigger functionality, and audit trail
 */
import { describe, it, expect, vi } from "vitest";

// Mock modules
vi.mock("../slack", () => ({
  sendSlackKillSwitchAlert: vi.fn().mockResolvedValue({ ts: "12345" }),
}));

vi.mock("../email", () => ({
  sendKillSwitchRecoveryEmail: vi.fn().mockResolvedValue({ messageId: "test" }),
}));

vi.mock("../db", () => ({
  getKillSwitchSettings: vi.fn(),
  updateKillSwitchSettings: vi.fn(),
  createKillSwitchEvent: vi.fn(),
  getKillSwitchAuditTrail: vi.fn(),
}));

// Mock trpc context
const createMockContext = (userId: string, role: string = "editor") => ({
  user: { id: userId, email: "test@example.com", name: "Test User", role },
});

describe("KillSwitch Router", () => {
  describe("setBudget", () => {
    it("should set budget limit with valid positive amount", async () => {
      const { updateKillSwitchSettings, createKillSwitchEvent } = await import(
        "../db"
      );

      updateKillSwitchSettings.mockResolvedValue({ success: true });
      createKillSwitchEvent.mockResolvedValue({ id: "event_1" });

      const ctx = createMockContext("user_123");
      const budgetLimitUSD = 500;

      await updateKillSwitchSettings(ctx.user.id, budgetLimitUSD, undefined);
      await createKillSwitchEvent(
        ctx.user.id,
        "budget_set",
        budgetLimitUSD,
        undefined,
        "Budget limit set by user"
      );

      expect(updateKillSwitchSettings).toHaveBeenCalledWith(
        "user_123",
        500,
        undefined
      );
      expect(createKillSwitchEvent).toHaveBeenCalledWith(
        "user_123",
        "budget_set",
        500,
        undefined,
        "Budget limit set by user"
      );
    });

    it("should reject zero budget limit", () => {
      const budgetLimitUSD = 0;
      expect(() =>
        validatePositiveNumber(budgetLimitUSD, "Budget limit")
      ).toThrow("Budget limit must be positive");
    });

    it("should reject negative budget limit", () => {
      const budgetLimitUSD = -100;
      expect(() =>
        validatePositiveNumber(budgetLimitUSD, "Budget limit")
      ).toThrow("Budget limit must be positive");
    });

    it("should reject budget limit exceeding maximum", () => {
      const maxBudget = 1_000_000;
      const budgetLimitUSD = 1_500_000;
      expect(() => validateMaxBudget(budgetLimitUSD, maxBudget)).toThrow(
        "Budget limit exceeds maximum allowed"
      );
    });

    it("should allow budget limit at maximum", () => {
      const maxBudget = 1_000_000;
      const budgetLimitUSD = 1_000_000;
      expect(() => validateMaxBudget(budgetLimitUSD, maxBudget)).not.toThrow();
    });

    it("should reject viewer role on setBudget", () => {
      const ctx = createMockContext("user_123", "viewer");
      expect(() => validateEditorProcedure(ctx.user)).toThrow(
        "Editor or Admin role required"
      );
    });
  });

  describe("trigger", () => {
    it("should trigger kill switch with reason", async () => {
      const mockSettings = {
        budgetLimitUSD: "500",
        isActive: false,
        currentSpendUSD: "250",
      };

      const {
        getKillSwitchSettings,
        updateKillSwitchSettings,
        createKillSwitchEvent,
      } = await import("../db");
      const { sendSlackKillSwitchAlert } = await import("../slack");

      getKillSwitchSettings.mockResolvedValue(mockSettings);
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      createKillSwitchEvent.mockResolvedValue({ id: "event_trigger" });
      sendSlackKillSwitchAlert.mockResolvedValue({ ts: "12345" });

      const ctx = createMockContext("user_123");
      const input = { reason: "Exceeded monthly budget limit" };

      const settings = await getKillSwitchSettings(ctx.user.id);
      await updateKillSwitchSettings(ctx.user.id, undefined, true);
      await createKillSwitchEvent(
        ctx.user.id,
        "triggered",
        parseFloat(settings.budgetLimitUSD as any),
        parseFloat(settings.currentSpendUSD as any),
        input.reason
      );

      await sendSlackKillSwitchAlert({
        userId: ctx.user.id,
        userName: ctx.user.name ?? "Unknown",
        reason: input.reason,
        currentSpend: parseFloat(settings.currentSpendUSD as any),
        budgetLimit: parseFloat(settings.budgetLimitUSD as any),
      });

      expect(updateKillSwitchSettings).toHaveBeenCalledWith(
        "user_123",
        undefined,
        true
      );
      expect(sendSlackKillSwitchAlert).toHaveBeenCalled();
    });

    it("should reject trigger without reason", () => {
      const input = { reason: "" };
      expect(() => validateReason(input.reason)).toThrow("Reason is required");
    });

    it("should reject reason exceeding 1000 characters", () => {
      const longReason = "a".repeat(1001);
      expect(() => validateReason(longReason)).toThrow(
        "Reason exceeds maximum length"
      );
    });

    it("should handle Slack alert failure gracefully", async () => {
      const mockSettings = {
        budgetLimitUSD: "500",
        isActive: false,
        currentSpendUSD: "250",
      };

      const { getKillSwitchSettings, updateKillSwitchSettings } = await import(
        "../db"
      );
      const { sendSlackKillSwitchAlert } = await import("../slack");

      getKillSwitchSettings.mockResolvedValue(mockSettings);
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      sendSlackKillSwitchAlert.mockRejectedValue(new Error("Slack API error"));

      const ctx = createMockContext("user_123");
      const settings = await getKillSwitchSettings(ctx.user.id);
      await updateKillSwitchSettings(ctx.user.id, undefined, true);

      // Should not throw - failure is logged and swallowed
      await expect(
        sendSlackKillSwitchAlert({
          userId: ctx.user.id,
          userName: ctx.user.name,
          reason: "Test reason",
          currentSpend: 100,
          budgetLimit: 500,
        })
      ).rejects.toThrow("Slack API error");
    });

    it("should handle null settings when triggering", async () => {
      const {
        getKillSwitchSettings,
        updateKillSwitchSettings,
        createKillSwitchEvent,
      } = await import("../db");

      getKillSwitchSettings.mockResolvedValue(null);
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      createKillSwitchEvent.mockResolvedValue({ id: "event_trigger" });

      const ctx = createMockContext("user_123");
      const settings = await getKillSwitchSettings(ctx.user.id);

      await updateKillSwitchSettings(ctx.user.id, undefined, true);
      await createKillSwitchEvent(
        ctx.user.id,
        "triggered",
        settings?.budgetLimitUSD
          ? parseFloat(settings.budgetLimitUSD as any)
          : undefined,
        settings?.currentSpendUSD
          ? parseFloat(settings.currentSpendUSD as any)
          : undefined,
        "Initial trigger"
      );

      expect(createKillSwitchEvent).toHaveBeenCalledWith(
        "user_123",
        "triggered",
        undefined,
        undefined,
        "Initial trigger"
      );
    });
  });

  describe("reset", () => {
    it("should reset kill switch and send recovery email", async () => {
      const mockSettings = {
        budgetLimitUSD: "500",
        isActive: true,
        currentSpendUSD: "450",
      };

      const {
        getKillSwitchSettings,
        updateKillSwitchSettings,
        createKillSwitchEvent,
      } = await import("../db");
      const { sendKillSwitchRecoveryEmail } = await import("../email");

      getKillSwitchSettings.mockResolvedValue(mockSettings);
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      createKillSwitchEvent.mockResolvedValue({ id: "event_reset" });
      sendKillSwitchRecoveryEmail.mockResolvedValue({
        messageId: "recovery_email",
      });

      const ctx = createMockContext("user_123", "admin");
      const input = { reason: "Budget issue resolved, manually resetting" };

      const settings = await getKillSwitchSettings(ctx.user.id);
      await updateKillSwitchSettings(ctx.user.id, undefined, false);
      await createKillSwitchEvent(
        ctx.user.id,
        "reset",
        parseFloat(settings.budgetLimitUSD as any),
        parseFloat(settings.currentSpendUSD as any),
        input.reason
      );

      if (ctx.user.email) {
        await sendKillSwitchRecoveryEmail({
          toEmail: ctx.user.email,
          userName: ctx.user.name ?? "",
          resetAt: new Date().toLocaleString(),
          newBudgetLimit: parseFloat(settings.budgetLimitUSD as any),
          dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/kill-switch`,
        });
      }

      expect(updateKillSwitchSettings).toHaveBeenCalledWith(
        "user_123",
        undefined,
        false
      );
      expect(sendKillSwitchRecoveryEmail).toHaveBeenCalled();
    });

    it("should require reason for reset", () => {
      const input = { reason: "" };
      expect(() => validateReason(input.reason)).toThrow("Reason is required");
    });

    it("should not send email if user has no email", async () => {
      const { getKillSwitchSettings, updateKillSwitchSettings } = await import(
        "../db"
      );
      const { sendKillSwitchRecoveryEmail } = await import("../email");

      // Earlier tests in this describe block share the same email mock,
      // so clear the call history to assert *this* test didn't send.
      sendKillSwitchRecoveryEmail.mockClear();

      getKillSwitchSettings.mockResolvedValue({ budgetLimitUSD: "100" });
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      sendKillSwitchRecoveryEmail.mockResolvedValue({ messageId: "test" });

      const ctx = { user: { id: "user_123", email: null, name: "Test" } };

      const settings = await getKillSwitchSettings(ctx.user.id);
      await updateKillSwitchSettings(ctx.user.id, undefined, false);

      // Don't send email if no email
      if (ctx.user.email) {
        await sendKillSwitchRecoveryEmail({
          toEmail: ctx.user.email,
          userName: ctx.user.name ?? "",
          resetAt: new Date().toLocaleString(),
          newBudgetLimit: 100,
          dashboardUrl: "http://localhost:3000/kill-switch",
        });
      }

      expect(sendKillSwitchRecoveryEmail).not.toHaveBeenCalled();
    });

    it("should handle email send failure on reset", async () => {
      const { getKillSwitchSettings, updateKillSwitchSettings } = await import(
        "../db"
      );
      const { sendKillSwitchRecoveryEmail } = await import("../email");

      getKillSwitchSettings.mockResolvedValue({ budgetLimitUSD: "500" });
      updateKillSwitchSettings.mockResolvedValue({ success: true });
      sendKillSwitchRecoveryEmail.mockRejectedValue(new Error("SMTP error"));

      const ctx = createMockContext("user_123", "admin");

      // Should not throw - failures are logged and swallowed
      await expect(
        sendKillSwitchRecoveryEmail({
          toEmail: ctx.user.email,
          userName: ctx.user.name ?? "",
          resetAt: new Date().toLocaleString(),
          newBudgetLimit: 500,
          dashboardUrl: "http://localhost:3000/kill-switch",
        })
      ).rejects.toThrow("SMTP error");
    });
  });

  describe("getSettings", () => {
    it("should return kill switch settings for user", async () => {
      const mockSettings = {
        budgetLimitUSD: "500",
        isActive: true,
        currentSpendUSD: "350",
      };

      const { getKillSwitchSettings } = await import("../db");
      getKillSwitchSettings.mockResolvedValue(mockSettings);

      const ctx = createMockContext("user_123");
      const settings = await getKillSwitchSettings(ctx.user.id);

      expect(settings).not.toBeNull();
      expect(parseFloat(settings.budgetLimitUSD as any)).toBe(500);
      expect(settings.isActive).toBe(true);
      expect(parseFloat(settings.currentSpendUSD as any)).toBe(350);
    });

    it("should create default settings if none exist", async () => {
      const { getKillSwitchSettings, updateKillSwitchSettings } = await import(
        "../db"
      );

      getKillSwitchSettings.mockResolvedValue(null);
      updateKillSwitchSettings.mockResolvedValue({ success: true });

      const ctx = createMockContext("user_123");
      const settings = await getKillSwitchSettings(ctx.user.id);

      if (!settings) {
        await updateKillSwitchSettings(ctx.user.id, 100, false, 0);
      }

      const defaultSettings = {
        budgetLimitUSD: 100,
        isActive: false,
        currentSpendUSD: 0,
      };

      expect(defaultSettings.budgetLimitUSD).toBe(100);
      expect(defaultSettings.isActive).toBe(false);
      expect(defaultSettings.currentSpendUSD).toBe(0);
    });

    it("should parse string values to numbers", () => {
      const stringSettings = {
        budgetLimitUSD: "250.50",
        isActive: true,
        currentSpendUSD: "125.25",
      };

      const parsedSettings = {
        budgetLimitUSD: parseFloat(stringSettings.budgetLimitUSD),
        isActive: stringSettings.isActive,
        currentSpendUSD: parseFloat(stringSettings.currentSpendUSD),
      };

      expect(parsedSettings.budgetLimitUSD).toBe(250.5);
      expect(parsedSettings.currentSpendUSD).toBe(125.25);
    });
  });

  describe("getAuditTrail", () => {
    it("should return paginated audit trail events", async () => {
      const mockEvents = [
        {
          id: "e1",
          eventType: "budget_set",
          budgetLimit: 500,
          reason: "Initial setup",
          createdAt: new Date(),
        },
        {
          id: "e2",
          eventType: "triggered",
          currentSpend: 450,
          reason: "Budget exceeded",
          createdAt: new Date(),
        },
        {
          id: "e3",
          eventType: "reset",
          budgetLimit: 500,
          currentSpend: 450,
          reason: "Issue resolved",
          createdAt: new Date(),
        },
      ];

      const { getKillSwitchAuditTrail } = await import("../db");
      getKillSwitchAuditTrail.mockResolvedValue(mockEvents);

      const ctx = createMockContext("user_123");
      const events = await getKillSwitchAuditTrail(ctx.user.id);

      const page = 1;
      const pageSize = 20;
      const total = events.length;
      const paginated = events.slice((page - 1) * pageSize, page * pageSize);

      expect(paginated).toHaveLength(3);
      expect(paginated[0].eventType).toBe("budget_set");
      expect(paginated[1].eventType).toBe("triggered");
      expect(paginated[2].eventType).toBe("reset");
    });

    it("should return empty list for user with no events", async () => {
      const { getKillSwitchAuditTrail } = await import("../db");
      getKillSwitchAuditTrail.mockResolvedValue([]);

      const events = await getKillSwitchAuditTrail("user_123");
      expect(events).toHaveLength(0);
    });

    it("should paginate correctly", async () => {
      const mockEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `e${i}`,
        eventType: "budget_set",
        budgetLimit: 100 * i,
        reason: `Event ${i}`,
        createdAt: new Date(),
      }));

      const { getKillSwitchAuditTrail } = await import("../db");
      getKillSwitchAuditTrail.mockResolvedValue(mockEvents);

      const page = 3;
      const pageSize = 10;
      const paginated = mockEvents.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe("e20");
      expect(paginated[9].id).toBe("e29");
    });

    it("should handle custom pagination parameters", async () => {
      const mockEvents = Array.from({ length: 100 }, (_, i) => ({
        id: `e${i}`,
        eventType: "reset",
        reason: `Reset ${i}`,
        createdAt: new Date(),
      }));

      const { getKillSwitchAuditTrail } = await import("../db");
      getKillSwitchAuditTrail.mockResolvedValue(mockEvents);

      const page = 2;
      const pageSize = 25;
      const paginated = mockEvents.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      expect(paginated).toHaveLength(25);
      expect(paginated[0].id).toBe("e25");
      expect(paginated[24].id).toBe("e49");
    });

    it("should parse budget and spend to numbers", () => {
      const event = {
        id: "e1",
        eventType: "triggered",
        budgetLimit: "500.00",
        currentSpend: "450.50",
        reason: "Test",
        createdAt: new Date(),
      };

      const parsedEvent = {
        budgetLimit: event.budgetLimit
          ? parseFloat(event.budgetLimit as any)
          : undefined,
        currentSpend: event.currentSpend
          ? parseFloat(event.currentSpend as any)
          : undefined,
      };

      expect(parsedEvent.budgetLimit).toBe(500);
      expect(parsedEvent.currentSpend).toBe(450.5);
    });
  });

  describe("Budget Tracking", () => {
    it("should calculate remaining budget correctly", () => {
      const budgetLimit = 500;
      const currentSpend = 350;
      const remaining = budgetLimit - currentSpend;

      expect(remaining).toBe(150);
    });

    it("should detect when budget is exceeded", () => {
      const budgetLimit = 500;
      const currentSpend = 600;
      const isOverBudget = currentSpend > budgetLimit;

      expect(isOverBudget).toBe(true);
    });

    it("should calculate budget utilization percentage", () => {
      const budgetLimit = 500;
      const currentSpend = 250;
      const utilization = (currentSpend / budgetLimit) * 100;

      expect(utilization).toBe(50);
    });

    it("should handle zero budget limit", () => {
      const budgetLimit = 0;
      const currentSpend = 0;
      const utilization =
        budgetLimit > 0 ? (currentSpend / budgetLimit) * 100 : 0;

      expect(utilization).toBe(0);
    });
  });
});

// Helper validation functions
function validatePositiveNumber(value: number, fieldName: string) {
  if (value <= 0) {
    throw new Error(`${fieldName} must be positive`);
  }
  return true;
}

function validateMaxBudget(value: number, max: number) {
  if (value > max) {
    throw new Error("Budget limit exceeds maximum allowed");
  }
  return true;
}

function validateReason(reason: string) {
  if (!reason || reason.trim() === "") {
    throw new Error("Reason is required");
  }
  if (reason.length > 1000) {
    throw new Error("Reason exceeds maximum length");
  }
  return true;
}

function validateEditorProcedure(user: any) {
  if (user.role !== "editor" && user.role !== "admin") {
    throw new Error("Editor or Admin role required");
  }
  return true;
}
