import { test, expect, type Page } from "@playwright/test";
import { dismissBrowserNotices, loginViaUi, signupViaApi, uniqueTestUser } from "./helpers";

async function expectNoHorizontalPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));

  expect(
    Math.max(overflow.body, overflow.document),
    `page width ${Math.max(overflow.body, overflow.document)} exceeded viewport ${overflow.viewport}`,
  ).toBeLessThanOrEqual(overflow.viewport + 2);
}

const publicRoutes = ["/", "/overview", "/demo", "/pricing", "/trust", "/login", "/waitlist", "/legal"];

for (const viewport of [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-430", width: 430, height: 900 },
  { name: "tablet-820", width: 820, height: 1180 },
]) {
  test.describe(`Smoke responsive public UI: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("public surfaces stay inside the viewport and navigation remains usable", async ({ page }) => {
      test.setTimeout(120_000);
      await dismissBrowserNotices(page);

      for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        await expectNoHorizontalPageOverflow(page);
      }

      await page.goto("/", { waitUntil: "domcontentloaded" });
      const menuButton = page.getByRole("button", { name: /open navigation menu/i });
      await expect(menuButton).toBeVisible();
      const menuBox = await menuButton.boundingBox();
      expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(40);
      expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(40);
      await menuButton.click();
      await expect(page.getByRole("navigation").getByRole("link", { name: "Product" })).toBeVisible();
      await expectNoHorizontalPageOverflow(page);
    });
  });
}

test.describe("Smoke responsive authenticated product UI", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("workspace and scanner remain usable on a phone", async ({ page }) => {
    test.setTimeout(180_000);
    await dismissBrowserNotices(page);

    const user = uniqueTestUser("mobile");
    await signupViaApi(page, user);
    await page.context().clearCookies();
    await loginViaUi(page, user, "/workspace");

    await page.goto("/workspace");
    await expect(page).toHaveURL((url) => url.pathname === "/workspace");
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalPageOverflow(page);

    const createWorkspaceButton = page.getByRole("button", { name: /^create$/i });
    await expect(createWorkspaceButton).toBeVisible();
    const createBox = await createWorkspaceButton.boundingBox();
    expect(createBox?.height ?? 0).toBeGreaterThanOrEqual(40);

    await page.goto("/scanning");
    await expect(page).toHaveURL((url) => url.pathname === "/scanning");
    await expect(page.getByText(/target environment/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/live scan terminal/i)).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalPageOverflow(page);

    const configBox = await page.locator("aside.w-80").boundingBox();
    const terminalBox = await page.locator("aside.w-96").boundingBox();
    expect(configBox?.width ?? 0).toBeLessThanOrEqual(392);
    expect(terminalBox?.width ?? 0).toBeLessThanOrEqual(392);
  });
});
