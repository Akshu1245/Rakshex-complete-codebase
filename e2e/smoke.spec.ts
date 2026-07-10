import { test, expect } from "@playwright/test";

test.describe("Smoke: public pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DevPulse|Rakshex/i);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toContainText(/pricing|plan/i);
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Smoke: billing pages", () => {
  test("billing success page renders", async ({ page }) => {
    await page.goto("/billing/success");
    await expect(page.locator("body")).toBeVisible();
  });

  test("billing failure page renders", async ({ page }) => {
    await page.goto("/billing/failure");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Smoke: API health", () => {
  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    // A clean test machine does not provision the production database. The
    // endpoint must still respond honestly rather than masking that state.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(["ok", "degraded"]).toContain(body.status);
  });
});
