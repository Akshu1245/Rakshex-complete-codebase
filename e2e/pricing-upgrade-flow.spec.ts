import { test, expect } from "@playwright/test";

/**
 * Critical Path 4: Pricing & billing pages
 *
 * Public /pricing is an evaluation catalog (waitlist + invite login). It
 * must not depend on Razorpay/Stripe checkout. Authenticated billing
 * success still activates after a webhook upgrades the plan.
 */
test.describe("Critical Path 4: Pricing & Upgrade Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rakshex.cookieConsent.v1",
        JSON.stringify({ choice: "accepted", at: new Date().toISOString() }),
      );
    });
  });

  test("visitor sees evaluation prices and waitlist CTAs without checkout", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { name: /evaluation pricing/i })).toBeVisible();
    await expect(page.getByText("Rakshex Free")).toBeVisible();
    await expect(page.getByText("Rakshex Pro")).toBeVisible();
    await expect(page.getByText("Rakshex Enterprise")).toBeVisible();
    await expect(page.getByText("$99")).toBeVisible();
    await expect(page.getByRole("button", { name: /join waitlist/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in with an invite/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /get started/i })).toHaveCount(0);
    await expect(page.locator('a[href="/register"]')).toHaveCount(0);
  });

  test("billing success page activates once webhook upgrades the plan", async ({ page }) => {
    await page.route("**/api/trpc/**", async (route) => {
      const urlStr = route.request().url();
      const url = new URL(urlStr);

      const match = url.pathname.match(/\/api\/trpc\/(.+)$/);
      if (!match) return route.continue();

      const endpointStr = match[1];
      const endpoints = endpointStr.split(",");

      const mockData: Record<string, any> = {
        "auth.me": {
          id: 1,
          email: "e2e@example.com",
          name: "E2E User",
          plan: "free",
        },
        "payment.getCurrentPlan": { plan: "pro", status: "active" },
      };

      const responseArray = endpoints.map((endpoint) => {
        const data = mockData[endpoint];
        if (data !== undefined) {
          return { result: { data: { json: data } } };
        }
        return null;
      });

      if (responseArray.some((res) => res === null)) {
        return route.continue();
      }

      const isBatch = endpoints.length > 1 || url.searchParams.get("batch") === "1";

      return route.fulfill({
        status: 200,
        body: JSON.stringify(isBatch ? responseArray : responseArray[0]),
        contentType: "application/json",
      });
    });

    await page.goto("/billing/success");
    await expect(page.getByRole("heading", { name: /payment successful/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  });
});
