import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "server/**/*.test.ts",
      "server/**/*.test.tsx",
    ],
    exclude: [
      "devpulse-frontend/**",
      "devpulse-vscode/**",
      "e2e/**",
      "node_modules/**",
      "dist/**",
    ],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
