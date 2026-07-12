import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = process.env.PLAYWRIGHT_FRONTEND_PORT || "3001";
const BACKEND_PORT = process.env.PORT || "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
      // Monorepo API entry (tsx). Requires DATABASE_URL/REDIS_URL or in-memory fallbacks.
      command: "pnpm --filter @rakshex/api exec tsx _core/index.ts",
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NODE_ENV: "test",
        PORT: BACKEND_PORT,
        JWT_SECRET: "test-only-jwt-secret-with-at-least-32-characters",
        DATABASE_URL:
          process.env.DATABASE_URL || "postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex_e2e",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        USE_IN_MEMORY_REDIS: process.env.USE_IN_MEMORY_REDIS || "false",
      },
    },
    {
      command: `pnpm --filter @rakshex/web exec next dev -p ${FRONTEND_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_TS_API_URL: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
});
