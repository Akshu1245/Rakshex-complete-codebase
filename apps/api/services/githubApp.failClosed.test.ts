/**
 * GitHub App fail-closed without credentials in production.
 * Webhook signature fail-closed is covered in api/githubCiScan.test.ts.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("GitHub App fail-closed without credentials in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppId = process.env.GITHUB_APP_ID;
  const originalKey = process.env.GITHUB_APP_PRIVATE_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;

    vi.doMock("../db", () => ({
      upsertGithubInstallation: vi.fn(),
    }));
    vi.doMock("../_core/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAppId === undefined) delete process.env.GITHUB_APP_ID;
    else process.env.GITHUB_APP_ID = originalAppId;
    if (originalKey === undefined) delete process.env.GITHUB_APP_PRIVATE_KEY;
    else process.env.GITHUB_APP_PRIVATE_KEY = originalKey;
    vi.resetModules();
  });

  it("getInstallationClient throws instead of returning a mock client", async () => {
    const { getInstallationClient } = await import("../services/githubApp");
    await expect(getInstallationClient(12345)).rejects.toThrow(/GitHub App/);
  });

  it("listReposForInstallation throws instead of returning mock repos", async () => {
    const { listReposForInstallation } = await import("../services/githubApp");
    await expect(listReposForInstallation(12345)).rejects.toThrow(/GitHub App/);
  });

  it("linkInstallation throws before persisting when credentials missing", async () => {
    const { linkInstallation } = await import("../services/githubApp");
    await expect(linkInstallation(99, 1, "acme", "Organization")).rejects.toThrow(
      /GitHub App is not configured/,
    );
  });
});
