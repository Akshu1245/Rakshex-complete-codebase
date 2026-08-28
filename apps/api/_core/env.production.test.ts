import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("production environment validation", () => {
  it("fails closed instead of booting with repository-known secret defaults", async () => {
    process.env.NODE_ENV = "production";
    for (const key of [
      "JWT_SECRET",
      "RAKSHEX_VAULT_KEY",
      "DATABASE_URL",
      "REDIS_URL",
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "APP_URL",
      "FRONTEND_URL",
      "METRICS_TOKEN",
      "GITHUB_WEBHOOK_SECRET",
    ]) {
      delete process.env[key];
    }

    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    await expect(import("./env")).rejects.toThrow("process.exit:1");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("accepts explicit production-critical configuration", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      JWT_SECRET: "test-production-jwt-secret-at-least-32-characters",
      RAKSHEX_VAULT_KEY: "test-production-vault-key-at-least-32-characters",
      DATABASE_URL: "postgresql://rakshex:test@127.0.0.1:5432/rakshex",
      REDIS_URL: "redis://127.0.0.1:6379",
      SMTP_HOST: "smtp.example.test",
      SMTP_USER: "mailer@example.test",
      SMTP_PASS: "test-production-smtp-password",
      SMTP_FROM: "noreply@example.test",
      APP_URL: "https://app.example.test",
      FRONTEND_URL: "https://app.example.test",
      CORS_ORIGINS: "https://www.example.test",
      METRICS_TOKEN: "test-metrics-token-at-least-16",
      GITHUB_WEBHOOK_SECRET: "test-github-webhook-secret-at-least-16",
    });

    const { ENV, validateEnv } = await import("./env");
    expect(ENV.isProduction).toBe(true);
    expect(() => validateEnv()).not.toThrow();
  });
});
