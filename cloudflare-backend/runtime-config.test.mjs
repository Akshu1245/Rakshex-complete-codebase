import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeConfig } from './runtime-config.mjs';
test('resolves Secrets Store bindings before container startup', async () => {
  const result = await resolveRuntimeConfig({DATABASE_URL: {get: async () => 'postgresql://db'}, JWT_SECRET: {get: async () => 'key'}, DEVPULSE_ENCRYPTION_KEY: {get: async () => 'encryption'}, FRONTEND_URL: 'https://app.example'});
  assert.equal(result.DATABASE_URL, 'postgresql://db');
  assert.equal(result.ENV, 'production');
  assert.equal(result.RESOURCE_PROFILE, 'free');
  assert.equal(result.GROQ_API_KEY, undefined);
});
test('passes explicit resource settings without silently increasing them', async () => {
  const result = await resolveRuntimeConfig({DATABASE_URL: 'postgresql://db', JWT_SECRET: 'key', DEVPULSE_ENCRYPTION_KEY: 'key', FRONTEND_URL: 'https://app.example', RESOURCE_PROFILE: 'standard', HEALTH_PROBE_INTERVAL_SECONDS: '600', CHANGE_PROBE_INTERVAL_SECONDS: '1800', DB_POOL_MAX: '2'});
  assert.equal(result.RESOURCE_PROFILE, 'standard');
  assert.equal(result.HEALTH_PROBE_INTERVAL_SECONDS, '600');
  assert.equal(result.CHANGE_PROBE_INTERVAL_SECONDS, '1800');
  assert.equal(result.DB_POOL_MAX, '2');
});
test('missing or unreadable secrets prevent container startup', async () => {
  await assert.rejects(resolveRuntimeConfig({}));
  await assert.rejects(resolveRuntimeConfig({DATABASE_URL: {get: async () => {throw new Error('unavailable');}}}));
});
