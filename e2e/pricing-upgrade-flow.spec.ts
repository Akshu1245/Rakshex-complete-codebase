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
    await page.context().addCookies([
      {
        name: "dp_session",
        value: "test-session",
        url: "http://localhost:3000",
      },
    ]);

    await page.route("**/api/trpc/**", async route => {
      const url = route.request().url();
      const json = (data: unknown) => ({ result: { data } });

      if (url.includes("auth.me")) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(
            json({
              id: 1,
              email: "e2e@example.com",
              name: "E2E User",
              plan: "free",
            })
          ),
          contentType: "application/json",
        });
      }
      if (url.includes("payment.getPlans")) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(
            json([
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
            ])
          ),
          contentType: "application/json",
        });
      }
      if (url.includes("payment.getCurrentPlan")) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(json({ plan: "free", status: "none" })),
          contentType: "application/json",
        });
      }
      if (url.includes("payment.createSubscription")) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(
            json({
              subscriptionId: "sub_test_123",
              customerId: "cust_test_123",
              shortUrl: "https://rzp.io/i/test-hosted-checkout",
              keyId: "rzp_test_key",
            })
          ),
          contentType: "application/json",
        });
      }
      return route.continue();
    });

    // Keep Playwright inside our origin when the app redirects to Razorpay.
    await page.route("https://rzp.io/**", route =>
      route.fulfill({
        status: 200,
        body: "<html><body>Razorpay hosted checkout (mocked)</body></html>",
        contentType: "text/html",
      })
    );
  });

  test("free user can see plans and initiate upgrade to Pro", async ({
    page,
  }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: /choose your plan/i })
    ).toBeVisible();
    await expect(page.getByText(/^free$/i).first()).toBeVisible();
    await expect(page.getByText(/^pro$/i).first()).toBeVisible();
    await expect(page.getByText(/^enterprise$/i).first()).toBeVisible();

    const createSubPromise = page.waitForRequest(
      req =>
        req.url().includes("payment.createSubscription") &&
        req.method() === "POST"
    );
    await page.getByRole("button", { name: /upgrade to pro/i }).click();
    await createSubPromise;

    await page.waitForURL(/rzp\.io/, { timeout: 5000 });
  });

  test("billing success page activates once webhook upgrades the plan", async ({
    page,
  }) => {
    await page.route("**/api/trpc/**", async route => {
      const url = route.request().url();
      if (url.includes("payment.getCurrentPlan")) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            result: { data: { plan: "pro", status: "active" } },
          }),
          contentType: "application/json",
        });
      }
      return route.continue();
    });

    await page.goto("/billing/success");
    await expect(
      page.getByRole("heading", { name: /payment successful/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });
});
