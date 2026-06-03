import { type Page, expect } from "@playwright/test";

/**
 * Sign-in is OAuth-only in the UI (GitHub + Google). For E2E tests that need
 * an authenticated session against the real backend, we bootstrap a session by
 * calling the CSRF-exempt `auth.signup` / `auth.login` tRPC procedures directly.
 * `page.request` shares its cookie jar with the browser context, so the session
 * cookie set by the backend applies to subsequent page navigations.
 */

export interface TestUser {
  name: string;
  email: string;
  password: string;
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
