import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const BACKEND_DIR = path.resolve(__dirname, '../../devpulse-backend');
const UI_DIR = path.resolve(__dirname, '../../devpulse-dashboard-ui');
const DB = '/tmp/rakshex-e2e.db';
const DB_OLD = '/tmp/rakshex-e2e-unmigrated.db';
const PY = process.env.E2E_PYTHON || 'python';
const env = { DATABASE_URL: `sqlite+aiosqlite:///${DB}`, REDIS_URL: '', ENV: 'development' };

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:5055', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: `rm -f ${DB} && ${PY} ${path.resolve(__dirname, 'seed.py')} && ${PY} -m uvicorn main:app --host 127.0.0.1 --port 8055`,
      cwd: BACKEND_DIR, env: { ...process.env, ...env } as Record<string, string>,
      url: 'http://127.0.0.1:8055/health', timeout: 120_000, reuseExistingServer: false,
    },
    {
      // Second backend on a DB left at migration 002: real schema-guard 503s.
      command: `rm -f ${DB_OLD} && ${PY} ${path.resolve(__dirname, 'seed.py')} unmigrated && ${PY} -m uvicorn main:app --host 127.0.0.1 --port 8056`,
      cwd: BACKEND_DIR, env: { ...process.env, ...env, DATABASE_URL: `sqlite+aiosqlite:///${DB_OLD}` } as Record<string, string>,
      url: 'http://127.0.0.1:8056/health', timeout: 120_000, reuseExistingServer: false,
    },
    {
      // One production build, three servers: 5055 -> migrated backend, 5056 -> unmigrated backend (real 503),
      // 5057 -> backend address with nothing listening (real proxy "backend unavailable").
      command: 'npx next build && (BACKEND_URL=http://127.0.0.1:8056 npx next start -p 5056 -H 127.0.0.1 & ' +
               'BACKEND_URL=http://127.0.0.1:8099 npx next start -p 5057 -H 127.0.0.1 & ' +
               'BACKEND_URL=http://127.0.0.1:8055 exec npx next start -p 5055 -H 127.0.0.1)',
      cwd: UI_DIR, env: { ...process.env } as Record<string, string>,
      url: 'http://127.0.0.1:5055/login', timeout: 400_000, reuseExistingServer: false,
    },
  ],
});
