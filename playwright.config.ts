import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = process.env.PLAYWRIGHT_FRONTEND_PORT || "3001";
const BACKEND_PORT = process.env.PORT || "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Next dev compilation is intentionally serial here. It avoids test
  // timeouts from six simultaneous cold route compiles on clean runners.
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm run build && node dist/server/_core/index.js",
      // `/metrics` proves the HTTP server is accepting requests without
      // claiming that optional local dependencies (DB/Redis) are healthy.
      url: `http://localhost:${BACKEND_PORT}/metrics`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: BACKEND_PORT,
        JWT_SECRET: "test-only-jwt-secret-with-at-least-32-characters",
        USE_IN_MEMORY_REDIS: "true",
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT}`,
      cwd: "./devpulse-frontend",
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_TS_API_URL: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
