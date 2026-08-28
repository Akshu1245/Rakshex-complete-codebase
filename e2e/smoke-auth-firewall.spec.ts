import { test, expect } from "@playwright/test";
import { dismissBrowserNotices, loginViaUi, signupViaApi, uniqueTestUser } from "./helpers";

/**
 * Smoke: login + Agent Firewall decision.
 *
 * Sign-in is exercised through the real email/password form after the account
 * is created via the CSRF-exempt signup procedure (the UI register flow
 * redirects to email verification). The decision path is the dashboard
 * Agent Firewall page: register agent → delegate authority → evaluate.
 *
 * URL assertions use pathname, not a substring regex: `/login?redirect=%2Fagent-firewall`
 * matches `/\/agent-firewall/` and would hide an AuthGuard bounce.
 */
test.describe("Smoke: login and Agent Firewall decision", () => {
  test("signed-in user can evaluate an action on the firewall page", async ({ page }) => {
    test.setTimeout(90_000);
    await dismissBrowserNotices(page);

    const user = uniqueTestUser("fw");
    await signupViaApi(page, user);
    await page.context().clearCookies();

    await loginViaUi(page, user);
    await page.goto("/agent-firewall");
    await expect(page).toHaveURL((url) => url.pathname === "/agent-firewall");
    await expect(page.getByRole("heading", { name: /agent firewall/i })).toBeVisible({
      timeout: 20_000,
    });

    const agentKey = `smoke-agent-${Date.now().toString(36)}`;
    await page.getByPlaceholder("Finance support agent").fill("Smoke Refund Agent");
    await page.getByPlaceholder("finance-support-prod").fill(agentKey);
    await page.getByRole("button", { name: /register agent/i }).click();
    await expect(page.getByRole("option", { name: /Smoke Refund Agent/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /create delegated authority/i }).click();
    await expect(page.getByText(/copy now/i)).toBeVisible({ timeout: 15_000 });

    const evaluate = page.getByRole("button", { name: /evaluate action/i });
    await expect(evaluate).toBeEnabled({ timeout: 10_000 });
    await evaluate.click();
    await expect(page.getByText(/Decision:\s*ALLOW/i)).toBeVisible({ timeout: 15_000 });
  });
});
