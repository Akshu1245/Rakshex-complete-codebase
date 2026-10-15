import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Staging-like: real browser, production Next build, real FastAPI backend on PostgreSQL (rate-limit
// counters in PG, no Redis), FREE plan (1000 reads / 100 writes per hour). One simulated hour.
const PSQL = process.env.PSQL || 'psql';
const PG_ARGS = (process.env.PSQL_ARGS || '').split(' ').filter(Boolean);
const sql = (q: string) => execFileSync(PSQL, [...PG_ARGS, '-Atc', q]).toString().trim();

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('owner@e2e.test');
  await page.locator('input[type=password]').fill('E2ePass!2345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15_000 });
}

for (const tabs of [1, 2, 5]) {
  test(`${tabs} dashboard tab(s), one simulated hour`, async ({ context }, info) => {
    test.setTimeout(600_000);
    await context.clock.install();
    const first = await context.newPage();
    await login(first);
    sql('DELETE FROM rate_limit_counters');
    sql('SELECT pg_stat_reset()');
    const seen: { path: string; status: number }[] = [];
    const pages: Page[] = [first];
    for (let i = 1; i < tabs; i++) pages.push(await context.newPage());
    for (const p of pages) {
      p.on('response', r => {
        const u = new URL(r.url());
        if (u.port === '5055' && (u.pathname.startsWith('/api/') || u.pathname === '/health')) seen.push({ path: `${r.request().method()} ${u.pathname}`, status: r.status() });
      });
    }
    // Different dashboard routes across tabs, like a real user.
    const routes = ['/', '/ops/alerts', '/ops/health', '/', '/ops/alerts'];
    for (let i = 0; i < tabs; i++) await pages[i]!.goto(routes[i]!);
    await first.waitForTimeout(3000);
    // bringToFront on the last one; Chromium headless reports all pages visible (worst case: all tabs polling).
    for (let m = 0; m < 60; m++) { await context.clock.runFor(60_000); await first.waitForTimeout(200); }
    await first.waitForTimeout(1500);
    const byPath: Record<string, number> = {};
    for (const s of seen) byPath[s.path] = (byPath[s.path] || 0) + 1;
    const counters = sql("SELECT key || '=' || count FROM rate_limit_counters ORDER BY key").split('\n').filter(Boolean);
    const increments = Number(sql('SELECT coalesce(sum(count),0) FROM rate_limit_counters'));
    await new Promise(r => setTimeout(r, 1500)); // let backends flush table stats
    const stat = sql("SELECT n_tup_ins||','||n_tup_upd||','||n_tup_del FROM pg_stat_user_tables WHERE relname='rate_limit_counters'");
    const out = {
      tabs, totalRequests: seen.length, byPath, status429: seen.filter(s => s.status === 429).length,
      rateLimitIncrements: increments, counters, pgStat_ins_upd_del: stat,
    };
    console.log('STAGING ' + JSON.stringify(out));
    await info.attach('staging.json', { body: JSON.stringify(out, null, 2), contentType: 'application/json' });
    expect(out.status429).toBe(0);
  });
}
