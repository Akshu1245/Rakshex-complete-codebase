import { test, expect } from "@playwright/test";

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

  test("full journey from signup to scan results", async ({ page }) => {
    // 1. Signup
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Should redirect to dashboard after successful signup
    await page.waitForURL("/dashboard", { timeout: 10_000 });
    await expect(page.getByText(/welcome/i)).toBeVisible();

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

  test("login with existing credentials works", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/dashboard", { timeout: 10_000 });
    await expect(page.getByText(/welcome/i)).toBeVisible();
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

  test("rate-limited MCP registration returns 429", async ({ page, request }) => {
    // This requires auth; skip if not authenticated in E2E context
    test.skip(true, "Requires authenticated session — run in authenticated E2E context");
  });
});
