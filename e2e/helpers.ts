import { type Page, expect } from "@playwright/test";

/**
 * Sign-in is OAuth-capable in the UI and also still exposes email/password.
 * For E2E tests that need an authenticated session against the real backend,
 * we create the user via the CSRF-exempt `auth.signup` tRPC procedure, then
 * (when we want to prove the form) sign in through `/login`.
 *
 * Next.js rewrites `/api/trpc/*` to the API. Session cookies are Set-Cookie'd
 * by the API process (port 3000). Playwright treats different ports as
 * different origins, so those cookies are mirrored onto the frontend origin
 * (port 3001) or the document request to `/agent-firewall` is bounced to login.
 *
 * Playwright `addCookies` rejects `{ url, path }` together ("Cookie should have
 * either url or path"). Path=/ cookies are bound with `url` only so they are
 * host-only on :3001. `domain=localhost` cookies are not used — Chromium does
 * not send them reliably.
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

export function apiOrigin(): string {
  return (
    process.env.PLAYWRIGHT_API_ORIGIN ||
    process.env.NEXT_PUBLIC_TS_API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function frontendOrigin(): string {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL.replace(/\/$/, "");
  }
  const port = process.env.PLAYWRIGHT_FRONTEND_PORT || "3001";
  return `http://localhost:${port}`;
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

function mutationBody(input: unknown) {
  return { json: input };
}

function trpcFailed(status: number, body: unknown): string | null {
  if (status >= 400) return `HTTP ${status} ${JSON.stringify(body)}`;
  const items = Array.isArray(body) ? body : [body];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const err = (rec.error ?? (rec.json as Record<string, unknown> | undefined)?.error) as
      Record<string, unknown> | undefined;
    if (err) return JSON.stringify(err);
  }
  return null;
}

const SESSION_COOKIE_NAMES = new Set(["access_token", "session", "csrf-token", "app_session_id"]);

function parseSetCookie(header: string): {
  name: string;
  value: string;
  path: string;
  httpOnly: boolean;
} | null {
  const parts = header.split(";").map((p) => p.trim());
  const pair = parts[0] ?? "";
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  let path = "/";
  let httpOnly = false;
  for (const part of parts.slice(1)) {
    const [k, v] = part.split("=", 2);
    if (!k) continue;
    if (k.toLowerCase() === "path" && v) path = v;
    if (k.toLowerCase() === "httponly") httpOnly = true;
  }
  return { name, value, path, httpOnly };
}

async function setCookieHeaders(res: {
  headersArray?: () => Array<{ name: string; value: string }>;
  headerValues?: (name: string) => Promise<string[]>;
}): Promise<string[]> {
  if (typeof res.headerValues === "function") {
    return res.headerValues("set-cookie");
  }
  return (res.headersArray?.() ?? [])
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
}

export async function applyApiCookiesToFrontend(
  page: Page,
  res: {
    headersArray?: () => Array<{ name: string; value: string }>;
    headerValues?: (name: string) => Promise<string[]>;
  },
): Promise<void> {
  const raw = await setCookieHeaders(res);
  const cookies = raw
    .map(parseSetCookie)
    .filter((c): c is NonNullable<typeof c> => Boolean(c && SESSION_COOKIE_NAMES.has(c.name)))
    // Path=/ only: Playwright forbids url+path together, and Chromium will not
    // send Domain=localhost cookies. Host-only via url is the reliable bind.
    .filter((c) => c.path === "/");
  expect(
    cookies.some((c) => c.name === "access_token"),
    `API auth response missing access_token (${raw.join(" | ")})`,
  ).toBe(true);
  const origin = frontendOrigin();
  await page.context().addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: `${origin}/`,
      httpOnly: c.httpOnly,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    })),
  );
}

export async function signupViaApi(page: Page, user: TestUser): Promise<void> {
  // Hit the Next rewrite so this uses the same origin the dashboard will.
  const res = await page.request.post("/api/trpc/auth.signup", {
    headers: { "content-type": "application/json" },
    data: mutationBody({ email: user.email, password: user.password, name: user.name }),
  });
  const body = await res.json().catch(() => ({}));
  const fail = trpcFailed(res.status(), body);
  expect(fail, `signup failed: ${fail}`).toBeNull();
}

export async function loginViaApi(page: Page, user: TestUser): Promise<void> {
  const res = await page.request.post("/api/trpc/auth.login", {
    headers: { "content-type": "application/json" },
    data: mutationBody({ email: user.email, password: user.password }),
  });
  const body = await res.json().catch(() => ({}));
  const fail = trpcFailed(res.status(), body);
  expect(fail, `login failed: ${fail}`).toBeNull();
  await applyApiCookiesToFrontend(page, res);
}

export async function loginViaUi(
  page: Page,
  user: TestUser,
  redirectTo = "/agent-firewall",
): Promise<void> {
  // Login's onSuccess does router.push(redirect || "/dashboard"). CI traces
  // on 016d7aa show dashboard/error.js then AuthGuard bouncing to
  // /login?redirect=/dashboard, which unmounts the firewall form. Send the
  // product's own redirect param so success lands on the page under test.
  await page.goto(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  const loginResponse = page.waitForResponse(
    (res) => res.url().includes("auth.login") && res.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  const res = await loginResponse;
  const body = await res.json().catch(() => ({}));
  const fail = trpcFailed(res.status(), body);
  expect(fail, `UI login mutation failed: ${fail}`).toBeNull();
  // Stamp Path=/ session cookies onto the frontend origin. The rewrite may
  // already have applied them; addCookies with `url` (no path) is idempotent
  // and does not replace them with Domain=localhost cookies Chromium drops.
  await applyApiCookiesToFrontend(page, res);
  await expect(
    page,
    `login did not reach ${redirectTo}; AuthGuard likely bounced to /login`,
  ).toHaveURL((url) => url.pathname === redirectTo, { timeout: 20_000 });
}
