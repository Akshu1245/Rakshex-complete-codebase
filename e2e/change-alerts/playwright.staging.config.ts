import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Staging-like local run: PostgreSQL (TEST_PG_URL), no Redis, free plan. Never points at production.
const BACKEND_DIR = path.resolve(__dirname, '../../devpulse-backend');
const UI_DIR = path.resolve(__dirname, '../../devpulse-dashboard-ui');
const PY = process.env.E2E_PYTHON || 'python';
const PG = process.env.TEST_PG_URL;
if (!PG) throw new Error('TEST_PG_URL (throwaway PostgreSQL) is required');
const env = { DATABASE_URL: PG, REDIS_URL: '', ENV: 'development' };

export default defineConfig({
  testDir: './tests-staging',
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5055', ...devices['Desktop Chrome'] },
  webServer: [
    {
      command: `${PY} ${path.resolve(__dirname, 'seed_staging.py')} && ${PY} -m uvicorn main:app --host 127.0.0.1 --port 8055`,
      cwd: BACKEND_DIR, env: { ...process.env, ...env } as Record<string, string>,
      url: 'http://127.0.0.1:8055/health', timeout: 120_000, reuseExistingServer: false,
    },
    {
      command: 'npx next build && BACKEND_URL=http://127.0.0.1:8055 exec npx next start -p 5055 -H 127.0.0.1',
      cwd: UI_DIR, env: { ...process.env } as Record<string, string>,
      url: 'http://127.0.0.1:5055/login', timeout: 400_000, reuseExistingServer: false,
    },
  ],
});
