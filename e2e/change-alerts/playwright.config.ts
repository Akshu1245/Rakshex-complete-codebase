import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const BACKEND_DIR = path.resolve(__dirname, '../../devpulse-backend');
const UI_DIR = path.resolve(__dirname, '../../devpulse-dashboard-ui');
const DB = '/tmp/rakshex-e2e.db';
const PY = process.env.E2E_PYTHON || 'python';
const env = { DATABASE_URL: `sqlite+aiosqlite:///${DB}`, REDIS_URL: '', ENV: 'development', SUSPICIOUS_THRESHOLD: '5000' };

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
      command: 'npx next dev -p 5055 -H 127.0.0.1',
      cwd: UI_DIR, env: { ...process.env, BACKEND_URL: 'http://127.0.0.1:8055' } as Record<string, string>,
      url: 'http://127.0.0.1:5055/login', timeout: 180_000, reuseExistingServer: false,
    },
  ],
});
