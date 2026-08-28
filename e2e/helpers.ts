import { type Page, expect } from "@playwright/test";

/**
 * Sign-in is OAuth-capable in the UI and also still exposes email/password.
 * For E2E tests that need an authenticated session against the real backend,
 * we bootstrap a user via the CSRF-exempt `auth.signup` tRPC procedure, then
 * (when we want to prove the form) sign in through `/login`.
 *
 * `page.request` shares its cookie jar with the browser context, so cookies
 * set through the Next.js `/api/trpc` rewrite apply to subsequent navigations.
 */

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function uniqueTestUser(prefix = "e2e"): TestUser {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: "E2E Test User",
    email: `${prefix}-${stamp}@rakshex.test`,
    password: "TestPassword123!",
  };
}

export async function dismissBrowserNotices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "rakshex-cookie-consent",
      JSON.stringify({ analytics: false, chat: false, timestamp: new Date().toISOString() }),
    );
    window.localStorage.setItem("rakshex_welcomed", "true");
  });
}

// httpBatchLink + superjson request body for a single mutation.
function batchBody(input: unknown) {
  return { "0": { json: input } };
}

export async function signupViaApi(page: Page, user: TestUser): Promise<void> {
  const res = await page.request.post("/api/trpc/auth.signup?batch=1", {
    headers: { "content-type": "application/json" },
    data: batchBody({ email: user.email, password: user.password, name: user.name }),
  });
  expect(res.ok(), `signup failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function loginViaApi(page: Page, user: TestUser): Promise<void> {
  const res = await page.request.post("/api/trpc/auth.login?batch=1", {
    headers: { "content-type": "application/json" },
    data: batchBody({ email: user.email, password: user.password }),
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function loginViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByLabel(/^email$/i).fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
}
