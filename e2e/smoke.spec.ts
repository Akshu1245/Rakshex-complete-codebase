import { test, expect } from "@playwright/test";
import { dismissBrowserNotices } from "./helpers";

/**
 * Fast Playwright smoke. This is what `pnpm test:e2e` / `pnpm test:e2e:smoke`
 * and the CI `e2e` job run (`--grep=Smoke`).
 *
 * Health must be 200 with a live database — a 503/degraded response used to
 * count as a pass and was how this suite could stay green without API+DB.
 */
test.describe("Smoke: public pages", () => {
  test.beforeEach(async ({ page }) => {
    await dismissBrowserNotices(page);
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RaksHex/i);
  });

  test("login page loads with email sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toContainText(/pricing|plan/i);
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Smoke: billing pages", () => {
  test("billing success page renders", async ({ page }) => {
    await dismissBrowserNotices(page);
    await page.goto("/billing/success");
    await expect(page.locator("body")).toBeVisible();
  });

  test("billing failure page renders", async ({ page }) => {
    await dismissBrowserNotices(page);
    await page.goto("/billing/failure");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Smoke: API health", () => {
  test("health endpoint reports a live database", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks?.database ?? body.db).toBe("ok");
    expect(body.checks?.redis ?? body.redis).toBe("ok");
  });
});
