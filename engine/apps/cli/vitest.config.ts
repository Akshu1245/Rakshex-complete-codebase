import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Real-CLI-process tests spawn tsx; 5s default flakes on loaded CI runners.
    testTimeout: 30000,
  },
});
