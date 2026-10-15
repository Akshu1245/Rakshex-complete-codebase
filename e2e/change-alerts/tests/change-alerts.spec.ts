import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const PW = 'E2ePass!2345';
const PY = process.env.E2E_PYTHON || 'python';

async function login(page: Page, user: string, base = '') {
  await page.goto(`${base}/login`);
  await page.locator('input[type=email]').fill(`${user}@e2e.test`);
  await page.locator('input[type=password]').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('devpulse_token')), { timeout: 15_000 }).not.toBeNull();
}
async function openPanel(page: Page) {
  const panel = page.getByTestId('monitored-apis');
  await expect(panel).toBeVisible();
  await expect(panel.locator('summary')).toContainText('selected');
  await page.waitForTimeout(300); // let the initial catalog/subscription load settle
  if ((await panel.getAttribute('open')) === null) await panel.locator('summary').click();
  await expect(page.getByTestId('sub-github')).toBeVisible();
}
const token = (page: Page) => page.evaluate(() => localStorage.getItem('devpulse_token'));

test('logged-out user sees sign-in message, no alerts', async ({ page }) => {
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-error')).toContainText('Sign in to view change alerts');
});

test('onboarding: owner subscribes to a supported API in the UI; real detector run produces a visible alert', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-workspace')).toHaveValue('wsA');
  await openPanel(page);
  await expect(page.getByTestId('unsupported-list')).toContainText('Stripe: NOT SUPPORTED');
  await expect(page.getByTestId('sub-stripe')).toHaveCount(0);
  const gh = page.getByTestId('sub-github');
  if (!(await gh.isChecked())) {
    await expect(page.getByTestId('ca-empty')).toBeVisible();
    await gh.check();
  }
  await expect(gh).toBeChecked();
  // persisted server-side for this workspace
  const subs = await page.evaluate(async t => (await fetch('/api/changes/workspaces/wsA/subscriptions', { headers: { Authorization: `Bearer ${t}` } })).json(), await token(page));
  expect(subs.subscriptions.map((s: { provider_id: string }) => s.provider_id)).toContain('github');
  execFileSync(PY, [path.resolve(__dirname, '../trigger_detector.py')], {
    env: { ...process.env, DATABASE_URL: 'sqlite+aiosqlite:////tmp/rakshex-e2e.db', REDIS_URL: '', ENV: 'development' }, stdio: 'pipe',
  });
  await page.reload();
  await expect(page.getByText(/schema change\(s\) detected in GitHub/).first()).toBeVisible();
  for (const t of ['REDDIT-BETA-ALERT', 'COINGECKO-NOBODY', 'LEGACY-ORPHAN-ALERT']) await expect(page.getByText(t)).toHaveCount(0);
});

test('owner acknowledges a real alert', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await expect(page.getByText(/detected in GitHub/).first()).toBeVisible();
  const before = await page.getByTestId('ca-acked').count();
  await page.getByRole('button', { name: 'Acknowledge' }).first().click();
  await expect(page.getByTestId('ca-acked')).toHaveCount(before + 1);
});

test('owner removes and re-adds a subscription (view/add/remove)', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await openPanel(page);
  const slack = page.getByTestId('sub-slack');
  await slack.check(); await expect(slack).toBeChecked();
  await page.reload(); await openPanel(page);
  await expect(page.getByTestId('sub-slack')).toBeChecked();
  await page.getByTestId('sub-slack').uncheck(); await expect(page.getByTestId('sub-slack')).not.toBeChecked();
});

test('workspace selection switches data; viewer role is read-only incl. subscriptions', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await page.getByTestId('ca-workspace').selectOption('wsB');
  await expect(page.getByTestId('ca-role')).toHaveText('role: viewer');
  await expect(page.getByText('REDDIT-BETA-ALERT field added')).toBeVisible();
  await expect(page.getByText(/detected in GitHub/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  await openPanel(page);
  await expect(page.getByTestId('sub-reddit')).toBeChecked();
  await expect(page.getByTestId('sub-reddit')).toBeDisabled();
});

test('member: sees alert, no ack button; forced ack 403 and forced subscribe 403 (real backend)', async ({ page }) => {
  await login(page, 'member');
  await page.goto('/ops/alerts');
  await expect(page.getByText(/detected in GitHub/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  const r = await page.evaluate(async t => {
    const h = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
    const list = await fetch('/api/changes/alerts?workspace_id=wsA', { headers: h }).then(x => x.json());
    const ack = (await fetch(`/api/changes/alerts/${list.alerts[0].id}/ack`, { method: 'POST', headers: h })).status;
    const sub = (await fetch('/api/changes/workspaces/wsA/subscriptions', { method: 'POST', headers: h, body: JSON.stringify({ provider_id: 'nasa' }) })).status;
    return { ack, sub };
  }, await token(page));
  expect(r).toEqual({ ack: 403, sub: 403 });
});

test('cross-workspace isolation: member of wsA cannot read/ack wsB alert (404 = missing)', async ({ page }) => {
  await login(page, 'member');
  await page.goto('/ops/alerts');
  await expect(page.getByText('REDDIT-BETA-ALERT')).toHaveCount(0);
  const r = await page.evaluate(async t => {
    const h = { Authorization: `Bearer ${t}` };
    const ws = await fetch('/api/changes/alerts?workspace_id=wsB', { headers: h });
    const view = await fetch('/api/changes/alerts/1', { headers: h });      // seeded Reddit alert in wsB
    const ack = await fetch('/api/changes/alerts/1/ack', { method: 'POST', headers: h });
    const missing = await fetch('/api/changes/alerts/999999', { headers: h });
    const subs = await fetch('/api/changes/workspaces/wsB/subscriptions', { headers: h });
    return { ws: ws.status, view: view.status, ack: ack.status, missing: missing.status, subs: subs.status,
             same: (await view.text()) === (await missing.text()) };
  }, await token(page));
  expect(r).toEqual({ ws: 404, view: 404, ack: 404, missing: 404, subs: 404, same: true });
});

test('empty state: user with no workspace', async ({ page }) => {
  await login(page, 'lonely');
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-empty-noworkspace')).toBeVisible();
});

test('REAL backend 503: schema not migrated -> UI shows migration-pending error', async ({ page }) => {
  const base = 'http://127.0.0.1:5056';
  await expect.poll(async () => (await page.request.get(`${base}/login`).catch(() => null))?.status(), { timeout: 60_000 }).toBe(200);
  await login(page, 'owner', base);
  await page.goto(`${base}/ops/alerts`);
  await expect(page.getByTestId('ca-error')).toContainText('database migration pending');
  await expect(page.getByTestId('ca-empty')).toHaveCount(0);
  const status = await page.evaluate(async t => (await fetch('/api/changes/alerts', { headers: { Authorization: `Bearer ${t}` } })).status, await token(page));
  expect(status).toBe(503);
});

test('REAL backend unreachable: proxy 503 -> UI shows unavailable error, not empty list', async ({ page }) => {
  const base = 'http://127.0.0.1:5057';
  await expect.poll(async () => (await page.request.get(`${base}/login`).catch(() => null))?.status(), { timeout: 60_000 }).toBe(200);
  await page.goto(`${base}/login`);
  await page.evaluate(() => localStorage.setItem('devpulse_token', 'not-a-real-token-backend-is-down'));
  await page.goto(`${base}/ops/alerts`);
  await expect(page.getByTestId('ca-error')).toContainText('Backend unavailable');
  await expect(page.getByTestId('ca-empty')).toHaveCount(0);
});

test('mobile nav: sidebar hidden by default at 390px and opens via toggle', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-390', 'mobile only');
  await page.goto('/ops/alerts');
  const box = await page.getByTestId('sidebar').boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1);
  await page.getByTestId('nav-toggle').click();
  await expect.poll(async () => (await page.getByTestId('sidebar').boundingBox())?.x).toBe(0);
});

test('no element in main content overflows the viewport (kill-switch row included)', async ({ page }, info) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await expect(page.getByText(/detected in GitHub/).first()).toBeVisible();
  await expect(page.getByTestId('ks-row')).toBeVisible();
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll('main *')).filter(el => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.right > vw + 1;
    }).map(el => `${el.tagName}.${(el as HTMLElement).className}`.slice(0, 80)).slice(0, 5);
  });
  await page.screenshot({ path: `screenshots/alerts-${info.project.name}.png`, fullPage: true });
  expect(offenders).toEqual([]);
});
