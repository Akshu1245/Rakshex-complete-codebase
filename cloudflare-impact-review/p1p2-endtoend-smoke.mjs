import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const reportPath=resolve('../engine/apps/cli/orders-impact-report.json');
const report=JSON.parse(readFileSync(reportPath,'utf8'));
assert.equal(report.schema,'impact-report.v1');
assert.equal(report.privacy_mode,true);
assert.equal(report.spec_hashes_verified,true);
assert.equal(report.metrics.candidate_matches,2);
assert.equal(report.metrics.dynamic_calls,1);
const sent=[];
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD')sent.push(r.url());});
  const response=await page.goto('https://rakshex-impact-review-staging.rakshex.workers.dev/',{waitUntil:'networkidle'});
  assert.equal(response?.status(),200);
  await page.locator('#file').setInputFiles(reportPath);
  await page.waitForFunction(()=>document.querySelector('#uncertain')?.textContent==='3');
  assert.equal(await page.locator('#affected').innerText(),'0');
  assert.equal(await page.locator('#uncertain').innerText(),'3');
  assert.equal(await page.locator('#other').innerText(),'0');
  const visible=await page.locator('body').innerText();
  for(const sensitive of ['/v1/orders','09-post-fetch.ts','10-post-axios.ts']) {
    assert.ok(!visible.includes(sensitive),'Private source metadata displayed');
  }
  assert.deepEqual(sent,[],'Report import must not send a POST request');
  await page.screenshot({path:'p1p2-actual-cli-to-cloudflare.png',fullPage:true});
  console.log('PASS original P1 event -> TS scanner -> privacy-safe JSON -> Cloudflare browser UI: 0 affected, 3 review, 0 other');
} finally { await browser.close(); }
