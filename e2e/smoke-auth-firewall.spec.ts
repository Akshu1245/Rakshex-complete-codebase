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
 *
 * The register form labels are "Display name" and "Stable agent key" (placeholders
 * "Finance support agent" / "finance-support-prod"). Locators use the labels and
 * wait until both inputs are editable so a slow workspace load cannot fill the
 * name field and then hang on a key input that is not mounted yet.
 */
test.describe("Smoke: login and Agent Firewall decision", () => {
  test("signed-in user can evaluate an action on the firewall page", async ({ page }) => {
    test.setTimeout(180_000);
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
    await expect(page.getByText(/create a workspace first/i)).toHaveCount(0);

    const register = page.locator("form").filter({
      has: page.getByRole("heading", { name: /register an agent/i }),
    });
    await expect(register).toBeVisible({ timeout: 20_000 });

    const nameInput = register.getByLabel(/^display name$/i);
    const keyInput = register.getByLabel(/^stable agent key$/i);
    await expect(nameInput).toBeEditable({ timeout: 15_000 });
    await expect(keyInput).toBeEditable({ timeout: 15_000 });

    const agentKey = `smoke-agent-${Date.now().toString(36)}`;
    await nameInput.fill("Smoke Refund Agent");
    await expect(page).toHaveURL((url) => url.pathname === "/agent-firewall");
    await keyInput.fill(agentKey);
    await register.getByRole("button", { name: /register agent/i }).click();
    // Native <option> elements are in the accessibility tree but `hidden`
    // until the <select> is opened. Attached is the honest check.
    await expect(page.getByRole("option", { name: /Smoke Refund Agent/ })).toBeAttached({
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
