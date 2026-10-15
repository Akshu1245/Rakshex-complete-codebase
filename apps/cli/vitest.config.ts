import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Real-CLI-process tests spawn tsx; 5s default timed out on GitHub runners (2 tests).
    testTimeout: 30000,
  },
});
