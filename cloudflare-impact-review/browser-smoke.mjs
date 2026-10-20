import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = 'https://rakshex-impact-review-staging.rakshex.workers.dev/';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const response = await page.goto(root, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  await page.getByRole('heading', { name: 'Change impact review' }).waitFor();
  await page.getByRole('button', { name: 'Load synthetic example' }).click();
  assert.equal(await page.locator('#affected').innerText(), '2');
  assert.equal(await page.locator('#uncertain').innerText(), '2');
  assert.equal(await page.locator('#other').innerText(), '1');
  await page.locator('#file').setInputFiles({
    name: 'impact.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      findings: [
        { classification: 'AFFECTED', filepath: '/private/customer/secret.ts', snippet: 'SECRET_SOURCE_DO_NOT_SHOW' },
        { classification: 'UNCERTAIN', reason: 'sensitive details here' }
      ]
    }))
  });
  assert.equal(await page.locator('#affected').innerText(), '1');
  assert.equal(await page.locator('#uncertain').innerText(), '1');
  assert.equal(await page.locator('#other').innerText(), '0');
  const content = await page.locator('body').innerText();
  assert.ok(!content.includes('SECRET_SOURCE_DO_NOT_SHOW'));
  assert.ok(!content.includes('/private/customer'));
  assert.equal(errors.length, 0, errors.join('; '));
  await page.screenshot({ path: 'rakshex-impact-review-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'rakshex-impact-review-mobile.png', fullPage: true });
  console.log('PASS: Cloudflare staging UI desktop/mobile, local report import and privacy check');
} finally {
  await browser.close();
}
