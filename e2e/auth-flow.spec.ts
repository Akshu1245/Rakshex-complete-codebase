import { test, expect } from "@playwright/test";

/**
 * Auth entry tests.
 *
 * Sign-up / sign-in is OAuth-only (GitHub + Google) — the email/password
 * forms were intentionally removed. These tests assert the OAuth surface and
 * that the legacy email/password fields are gone.
 */
test.describe("Auth: OAuth-only sign-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });
  });

  test("login page offers GitHub and Google sign-in", async ({ page }) => {
    await page.goto("/login");

    const github = page.getByRole("link", { name: /continue with github/i });
    const google = page.getByRole("link", { name: /continue with google/i });

    await expect(github).toBeVisible();
    await expect(google).toBeVisible();
    await expect(github).toHaveAttribute("href", "/api/oauth/github");
    await expect(google).toHaveAttribute("href", "/api/oauth/google");
  });

  test("login page does not expose email/password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: /email/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
  });

  test("/register redirects to the OAuth login page", async ({ page }) => {
    await page.goto("/register");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: /continue with github/i })).toBeVisible();
  });
});
