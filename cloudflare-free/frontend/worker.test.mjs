import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('private API forwarding preserves authentication, signed bytes and CSV', async () => {
  const body = '{"signed":"unchanged bytes"}';
  const env = {BACKEND: {async fetch(request) {
    assert.equal(request.headers.get('authorization'), 'Bearer test-session');
    assert.equal(request.headers.get('stripe-signature'), 'test-signature');
    assert.equal(await request.text(), body);
    return new Response('id,score\n1,75', {headers: {'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=report.csv'}});
  }}};
  const response = await worker.fetch(new Request('https://app.example/api/billing/webhook', {
    method: 'POST', body, headers: {authorization: 'Bearer test-session', 'stripe-signature': 'test-signature'},
  }), env);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-type'), 'text/csv');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(await response.text(), 'id,score\n1,75');
});

test('missing API routes retain backend errors instead of returning the HTML shell', async () => {
  const response = await worker.fetch(new Request('https://app.example/api/not-found'), {
    BACKEND: {fetch: async () => Response.json({detail: 'Not Found'}, {status: 404})},
    ASSETS: {fetch: () => {throw new Error('API must never hit static assets');}},
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {detail: 'Not Found'});
});

test('same-origin WebSocket discovery and documentation routing work', async () => {
  const info = await worker.fetch(new Request('https://app.example/connection-info'), {});
  assert.equal((await info.json()).health_websocket_url, 'wss://app.example/ws/health');
  await worker.fetch(new Request('https://app.example/backend-docs'), {BACKEND: {fetch: async request => {
    assert.equal(new URL(request.url).pathname, '/docs');
    return new Response('docs');
  }}});
});

test('upstream outages are explicit and static assets do not invoke the backend', async () => {
  const outage = await worker.fetch(new Request('https://app.example/health'), {BACKEND: {fetch: async () => {throw new Error('offline');}}});
  assert.equal(outage.status, 503);
  assert.equal(outage.headers.get('cache-control'), 'no-store');
  const page = await worker.fetch(new Request('https://app.example/login/'), {ASSETS: {fetch: async () => new Response('login page')}});
  assert.equal(await page.text(), 'login page');
});
