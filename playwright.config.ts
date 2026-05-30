import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Rakshex E2E tests.
 *
 * - Assumes the Next.js frontend dev server runs on http://localhost:3000
 * - All tRPC backend calls are stubbed inside each spec via page.route(),
 *   so no live backend / MySQL / Redis is required to run the tests.
 * - Browser: Chromium only (fastest for CI).
 */
export default defineConfig({
  // Directory containing the spec files
  testDir: "./e2e",

  // Parallelism & timeouts
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  // Reporting
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  // Shared settings for all projects
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Projects (browser configurations)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Automatically start both the Next.js frontend and the Express backend servers before running tests
  webServer: [
    {
      command: "pnpm run start",
      cwd: "./devpulse-frontend",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: "3000",
        NEXT_PUBLIC_API_URL: "http://localhost:3001",
      },
    },
    {
      command: "node dist/server/_core/index.js",
      cwd: ".",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: "3001",
        DATABASE_URL:
          process.env.DATABASE_URL || "mysql://root:devpulse@127.0.0.1:3306/devpulse_test",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        JWT_SECRET: process.env.JWT_SECRET || "test-secret-ci",
      },
    },
  ],
});
