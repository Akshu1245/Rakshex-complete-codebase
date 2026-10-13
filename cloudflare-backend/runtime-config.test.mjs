import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeConfig } from './runtime-config.mjs';
test('resolves Secrets Store bindings before container startup', async () => {
  const result = await resolveRuntimeConfig({DATABASE_URL: {get: async () => 'postgresql://db'}, JWT_SECRET: {get: async () => 'key'}, DEVPULSE_ENCRYPTION_KEY: {get: async () => 'encryption'}, FRONTEND_URL: 'https://app.example'});
  assert.equal(result.DATABASE_URL, 'postgresql://db');
  assert.equal(result.ENV, 'production');
  assert.equal(result.GROQ_API_KEY, undefined);
});
test('missing or unreadable secrets prevent container startup', async () => {
  await assert.rejects(resolveRuntimeConfig({}));
  await assert.rejects(resolveRuntimeConfig({DATABASE_URL: {get: async () => {throw new Error('unavailable');}}}));
});
