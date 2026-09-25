import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = (name: string) => resolve(root, "../../../packages", name, "src/index.ts");

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@rakshex/action-control": pkg("action-control"),
      "@rakshex/policy-engine": pkg("policy-engine"),
      "@rakshex/shared-types": pkg("shared-types"),
      "@rakshex/spend-meter": pkg("spend-meter"),
    },
  },
});
