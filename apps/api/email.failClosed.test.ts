import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("email fail-closed in production", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.resetModules();
  });

  it("throws when SMTP is missing in production", async () => {
    process.env.NODE_ENV = "production";
    // Ensure SMTP looks unset for this module load path
    process.env.SMTP_HOST = "";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASS = "";

    // env.ts may exit on production schema failure — stub ENV instead via dynamic import
    // after mocking _core/env.
    vi.doMock("./_core/env", () => ({
      ENV: {
        isProduction: true,
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPass: "",
        smtpFrom: "noreply@rakshex.in",
        appUrl: "https://rakshex.in",
      },
    }));
    vi.doMock("./_core/logger", () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }));

    const { sendWelcomeEmail } = await import("./email");
    await expect(sendWelcomeEmail({ toEmail: "a@b.com", userName: "Test" })).rejects.toThrow(
      /SMTP is not configured/,
    );
  });
});
