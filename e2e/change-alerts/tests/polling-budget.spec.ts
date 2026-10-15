import { test, expect, Page } from '@playwright/test';
const PW = 'E2ePass!2345';
async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('owner@e2e.test');
  await page.locator('input[type=password]').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15_000 });
}
for (const route of ['/', '/ops/alerts', '/ops/health']) {
  test(`measure polling budget for one simulated hour on ${route}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.clock.install();
    const reqs: { url: string; t: number; remaining: string | null; status: number }[] = [];
    page.on('response', r => {
      const u = new URL(r.url());
      if (u.port === '5055' && (u.pathname.startsWith('/api/') || u.pathname === '/health'))
        reqs.push({ url: `${r.request().method()} ${u.pathname}`, t: Date.now(), remaining: r.headers()['x-ratelimit-remaining'] ?? null, status: r.status() });
    });
    await login(page);
    await page.goto(route);
    await page.waitForTimeout(3000);
    const startN = reqs.length;
    for (let m = 0; m < 60; m++) { await page.clock.runFor(60_000); await page.waitForTimeout(150); }
    await page.waitForTimeout(1000);
    const byPath: Record<string, number> = {};
    for (const r of reqs.slice(startN)) byPath[r.url] = (byPath[r.url] || 0) + 1;
    const rem = reqs.map(r => r.remaining).filter(Boolean);
    const out = { route, initialLoad: startN, pollingPerHour: reqs.length - startN, byPath, firstRemaining: rem[0], lastRemaining: rem[rem.length - 1],
      status429: reqs.filter(r => r.status === 429).length };
    console.log('POLLING ' + JSON.stringify(out));
    await info.attach('polling.json', { body: JSON.stringify(out, null, 2), contentType: 'application/json' });
    expect(out.status429).toBe(0);
    // /health is rate-limit exempt; every other GET uses the read bucket (free tier 1000/h).
    expect(out.pollingPerHour - (byPath['GET /health'] || 0)).toBeLessThanOrEqual(130);
  });
}
