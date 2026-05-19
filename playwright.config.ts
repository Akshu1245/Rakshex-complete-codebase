import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for DevPulse E2E tests.
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
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],

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

  // Automatically start the Next.js dev server before running tests
  webServer: {
    command: "pnpm exec next dev",
    cwd: "./devpulse-frontend",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
