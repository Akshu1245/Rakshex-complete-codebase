import { test, expect } from "@playwright/test";

/**
 * Golden-path auth tests.
 *
 * These exercise the email/password flow wired through the
 * trpc.auth.signup and trpc.auth.login procedures. All backend
 * calls are stubbed so no live MySQL / Redis is required.
 */
test.describe("Auth: email/password golden path", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });
    page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on("request", (req) => console.log(`[BROWSER REQ] ${req.method()} ${req.url()}`));
    page.on("response", (res) => console.log(`[BROWSER RES] ${res.status()} ${res.url()}`));
  });

  test("register form renders with email, password, and name fields", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByTestId("signup-form")).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("login form renders with email, password, and remember-me", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /forgot password/i })).toBeVisible();
  });

  test("signup with weak password shows client-side validation error", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel(/full name/i).fill("Ada Lovelace");
    await page.getByLabel(/email/i).fill(`test-${Date.now()}@example.com`);
    // 7 chars - fails the >= 8 check
    await page.getByLabel(/password/i).fill("short12");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
      /at least 8 characters/i,
    );
  });

  test("login with invalid credentials surfaces server error", async ({ page }) => {
    // Stub the login mutation to return an authentication error
    await page.route("**/api/trpc/auth.login**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            message: "Invalid email or password",
            code: -32001,
            data: { code: "UNAUTHORIZED" },
          },
        }),
      }),
    );

    await page.goto("/login");

    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("signup → dashboard redirect (stubbed backend)", async ({ page }) => {
    // Stub the signup mutation to return a successful response
    await page.route("**/api/trpc/auth.signup**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              id: 42,
              email: "e2e@example.com",
              name: "E2E User",
            },
          },
        }),
      }),
    );

    // Stub auth.me so the dashboard page can identify the user after redirect
    await page.route("**/api/trpc/auth.me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              id: 42,
              email: "e2e@example.com",
              name: "E2E User",
              plan: "free",
            },
          },
        }),
      }),
    );

    await page.goto("/register");

    const email = `e2e-${Date.now()}@example.com`;
    await page.getByLabel(/full name/i).fill("E2E User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15_000 });
  });

  test("forgot-password reveals reset form and back-to-login link", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /forgot password/i }).click();

    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /back to login/i })).toBeVisible();
  });
});
