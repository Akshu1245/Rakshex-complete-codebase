import { test, expect } from "@playwright/test";

/**
 * Public evaluation pages must render without the Node API.
 * Production `api.rakshex.in` currently has a TLS SAN mismatch
 * (DNS → 84sv63xt.up.railway.app, cert is *.up.railway.app), so a hung
 * tRPC rewrite must not leave /pricing or /legal on a spinner.
 */
test.describe("Public evaluation pages without API", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });
    await page.route("**/api/trpc/**", (route) => route.abort());
  });

  test("pricing shows evaluation catalog prices without Loading plans", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { name: /evaluation pricing/i })).toBeVisible();
    await expect(page.getByText("Loading plans…")).toHaveCount(0);
    await expect(page.getByText("Rakshex Pro")).toBeVisible();
    await expect(page.getByText("$99")).toBeVisible();
    await expect(page.getByText("$499")).toBeVisible();
    await expect(page.getByRole("button", { name: /join waitlist/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toHaveCount(0);
  });

  test("legal center renders static documents without API", async ({ page }) => {
    await page.goto("/legal");

    await expect(page.getByRole("heading", { name: /clear documents/i })).toBeVisible();
    await expect(page.getByText("Loading...")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read online" }).nth(1)).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
