import { test, expect, Page } from '@playwright/test';

const PW = 'E2ePass!2345';

async function login(page: Page, user: string) {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(`${user}@e2e.test`);
  await page.locator('input[type=password]').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('devpulse_token')), { timeout: 15_000 }).not.toBeNull();
}
const card = (page: Page) => page.locator('div', { has: page.getByText('API Change Detection') }).last();

test('logged-out user sees sign-in message, no alerts', async ({ page }) => {
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-error')).toContainText('Sign in to view change alerts');
  await expect(page.getByText('GITHUB-ACME-ALERT')).toHaveCount(0);
});

test('owner: login, sees only own workspace alert, can acknowledge', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-workspace')).toHaveValue('wsA');
  await expect(page.getByTestId('ca-role')).toHaveText('role: owner');
  await expect(page.getByText('GITHUB-ACME-ALERT field removed', { exact: false }).first()).toBeVisible();
  for (const t of ['REDDIT-BETA-ALERT', 'COINGECKO-NOBODY', 'LEGACY-ORPHAN-ALERT']) await expect(page.getByText(t)).toHaveCount(0);
  const before = await page.getByTestId('ca-acked').count();
  await page.getByRole('button', { name: 'Acknowledge' }).first().click();
  await expect(page.getByTestId('ca-acked')).toHaveCount(before + 1);
});

test('workspace selection switches data; viewer role is read-only', async ({ page }) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await page.getByTestId('ca-workspace').selectOption('wsB');
  await expect(page.getByTestId('ca-role')).toHaveText('role: viewer');
  await expect(page.getByText('REDDIT-BETA-ALERT field added')).toBeVisible();
  await expect(page.getByText('GITHUB-ACME-ALERT')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  await expect(page.getByTestId('ca-readonly')).toBeVisible();
});

test('member: sees alert, no Acknowledge button; forced API ack is rejected 403', async ({ page }) => {
  await login(page, 'member');
  await page.goto('/ops/alerts');
  await expect(page.getByText('GITHUB-ACME-ALERT').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  const status = await page.evaluate(async () => {
    const list = await fetch('/api/changes/alerts?workspace_id=wsA', { headers: { Authorization: `Bearer ${localStorage.getItem('devpulse_token')}` } }).then(r => r.json());
    const id = list.alerts[0].id;
    return (await fetch(`/api/changes/alerts/${id}/ack`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('devpulse_token')}` } })).status;
  });
  expect(status).toBe(403);
});

test('cross-workspace isolation: outsider cannot see or ack wsA alert (404)', async ({ page }) => {
  await login(page, 'outsider');
  await page.goto('/ops/alerts');
  await expect(page.getByText('REDDIT-BETA-ALERT')).toBeVisible();
  await expect(page.getByText('GITHUB-ACME-ALERT')).toHaveCount(0);
  const r = await page.evaluate(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem('devpulse_token')}` };
    const ws = await fetch('/api/changes/alerts?workspace_id=wsA', { headers: h });
    const view = await fetch('/api/changes/alerts/1', { headers: h });
    const ack = await fetch('/api/changes/alerts/1/ack', { method: 'POST', headers: h });
    const missing = await fetch('/api/changes/alerts/999999', { headers: h });
    return { ws: ws.status, view: view.status, ack: ack.status, missing: missing.status, same: (await view.text()) === (await missing.text()) };
  });
  expect(r).toEqual({ ws: 404, view: 404, ack: 404, missing: 404, same: true });
});

test('empty state: user with no workspace', async ({ page }) => {
  await login(page, 'lonely');
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-empty-noworkspace')).toBeVisible();
});

test('error states: 503 and network failure are shown, not an empty list (stubbed responses)', async ({ page }) => {
  await login(page, 'owner');
  await page.route('**/api/changes/alerts?*', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Alert service unavailable: database migration pending"}' }));
  await page.goto('/ops/alerts');
  await expect(page.getByTestId('ca-error')).toContainText('temporarily unavailable');
  await expect(page.getByTestId('ca-empty')).toHaveCount(0);
  await page.unroute('**/api/changes/alerts?*');
  await page.route('**/api/changes/alerts?*', r => r.abort('failed'));
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('ca-error')).toContainText('Unable to reach the backend');
});

test('mobile nav: sidebar hidden by default at 390px and opens via toggle', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-390', 'mobile only');
  await page.goto('/ops/alerts');
  const box = await page.getByTestId('sidebar').boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1);
  await page.getByTestId('nav-toggle').click();
  await expect.poll(async () => (await page.getByTestId('sidebar').boundingBox())?.x).toBe(0);
});

test('no horizontal overflow on the alerts page card', async ({ page }, info) => {
  await login(page, 'owner');
  await page.goto('/ops/alerts');
  await expect(page.getByText('GITHUB-ACME-ALERT').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `screenshots/alerts-${info.project.name}.png`, fullPage: true });
  expect(overflow).toBeLessThanOrEqual(1);
});
