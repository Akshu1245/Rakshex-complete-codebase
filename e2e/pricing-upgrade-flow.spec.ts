import { test, expect } from "@playwright/test";

/**
 * Critical Path 4: Pricing & Upgrade Flow
 *
 * Pricing uses a Razorpay hosted-checkout handoff, so the real payment
 * form lives on checkout.razorpay.com — we CANNOT fill card fields
 * inside the app. Instead we:
 *   1. Stub the tRPC auth + payments endpoints so the UI renders as a
 *      signed-in free user.
 *   2. Intercept `payment.createSubscription` and return a fake shortUrl.
 *   3. Assert the UI attempts to navigate the user to that Razorpay URL.
 *   4. Stub `payment.getCurrentPlan` to `pro` and visit /billing/success
 *      to verify the success page activates when the webhook has
 *      finalized the upgrade.
 */
test.describe("Critical Path 4: Pricing & Upgrade Flow", () => {
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

    await page.context().addCookies([
      {
        name: "dp_session",
        value: "test-session",
        url: "http://localhost:3000",
      },
    ]);

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
        "payment.getPlans": [
          {
            id: "free",
            name: "Free",
            amount: 0,
            currency: "INR",
            interval: "month",
            features: ["Up to 2 collections"],
          },
          {
            id: "pro",
            name: "Pro",
            amount: 99900,
            currency: "INR",
            interval: "month",
            features: ["Unlimited", "Shadow API"],
          },
          {
            id: "enterprise",
            name: "Enterprise",
            amount: 499900,
            currency: "INR",
            interval: "month",
            features: ["SSO"],
          },
        ],
        "payment.getCurrentPlan": { plan: "free", status: "none" },
        "payment.createSubscription": {
          subscriptionId: "sub_test_123",
          customerId: "cust_test_123",
          shortUrl: "https://rzp.io/i/test-hosted-checkout",
          keyId: "rzp_test_key",
        },
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

    // Keep Playwright inside our origin when the app redirects to Razorpay.
    await page.route("https://rzp.io/**", (route) =>
      route.fulfill({
        status: 200,
        body: "<html><body>Razorpay hosted checkout (mocked)</body></html>",
        contentType: "text/html",
      }),
    );
  });

  test("free user can see plans and initiate upgrade to Pro", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { name: /choose your plan/i })).toBeVisible();
    await expect(page.getByText(/^free$/i).first()).toBeVisible();
    await expect(page.getByText(/^pro$/i).first()).toBeVisible();
    await expect(page.getByText(/^enterprise$/i).first()).toBeVisible();

    const createSubPromise = page.waitForRequest(
      (req) => req.url().includes("payment.createSubscription") && req.method() === "POST",
    );
    await page.getByRole("button", { name: /upgrade to pro/i }).click();
    await createSubPromise;

    await page.waitForURL(/rzp\.io/, { timeout: 5000 });
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
