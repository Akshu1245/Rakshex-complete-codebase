import { test, expect } from "@playwright/test";
import { signupViaApi, loginViaApi } from "./helpers";

/**
 * Critical user journey integration test.
 *
 * Exercises the full flow: signup → login → create collection → start scan → view results.
 * This is the #1 conversion path — if it breaks, we lose users.
 */

test.describe("Critical Journey: signup → scan → results", () => {
  const testUser = {
    name: "E2E Test User",
    email: `e2e-${Date.now()}@rakshex.test`,
    password: "TestPassword123!",
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });
  });

  test("full journey from signup to scan results", async ({ page }) => {
    // 1. Signup. Sign-in is OAuth-only in the UI, so we bootstrap a real
    // backend session via the CSRF-exempt auth.signup procedure, then land
    // on the dashboard exactly as an authenticated user would.
    await signupViaApi(page, testUser);
    await page.goto("/dashboard");
    await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 10_000 });

    // 2. Create a collection
    await page.goto("/collections");
    await page.getByRole("button", { name: /new collection/i }).click();
    await page.getByLabel(/name/i).fill("E2E Test Collection");
    await page.getByLabel(/format/i).selectOption("postman");

    // Paste a minimal Postman collection JSON
    const minimalCollection = JSON.stringify({
      info: {
        name: "Test",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "Test Request",
          request: { method: "GET", url: { raw: "https://api.example.com/test" } },
        },
      ],
    });
    await page.getByTestId("collection-data-input").fill(minimalCollection);
    await page.getByRole("button", { name: /create/i }).click();

    // Should show success and redirect to collections list
    await expect(page.getByText(/collection created/i)).toBeVisible();

    // 3. Start a scan
    await page.getByRole("button", { name: /scan/i }).first().click();
    await page.getByLabel(/scan type/i).selectOption("quick");
    await page.getByRole("button", { name: /start scan/i }).click();

    // Should show scan in progress or queued
    await expect(page.getByText(/scan (started|queued|in progress)/i)).toBeVisible();

    // 4. View results (may need to wait for scan to complete in CI)
    await page.goto("/scans");
    await expect(page.getByText(/e2e test collection/i)).toBeVisible();
  });

  test("returning user can authenticate and reach the dashboard", async ({ page }) => {
    const returning = {
      name: "Returning User",
      email: `e2e-return-${Date.now()}@rakshex.test`,
      password: "TestPassword123!",
    };
    // Create the account, drop the session, then sign back in via the
    // backend auth.login procedure to exercise the real login path.
    await signupViaApi(page, returning);
    await page.context().clearCookies();
    await loginViaApi(page, returning);

    await page.goto("/dashboard");
    await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 10_000 });
  });

  test("health check endpoint returns healthy status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBe("ok");
    expect(body.checks.redis).toBe("ok");
    expect(body.checks.memory).toBe("ok");
    expect(body.memory.heapUsedMB).toBeGreaterThan(0);
  });
});
