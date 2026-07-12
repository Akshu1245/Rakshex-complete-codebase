import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(root, "../../packages/shared-types/src"),
      "@rakshex/database": path.resolve(root, "../../packages/database/src/index.ts"),
      "@rakshex/database/schema": path.resolve(root, "../../packages/database/drizzle/schema.ts"),
      "@rakshex/database/schema-enterprise": path.resolve(
        root,
        "../../packages/database/drizzle/schema-enterprise.ts",
      ),
      "@rakshex/scanner-core": path.resolve(root, "../../packages/scanner-core/src/index.ts"),
      "@rakshex/policy-engine": path.resolve(root, "../../packages/policy-engine/src/index.ts"),
      "@rakshex/config": path.resolve(root, "../../packages/config/src/index.ts"),
      "@rakshex/shared-types": path.resolve(root, "../../packages/shared-types/src/index.ts"),
      "@rakshex/agentguard-sdk": path.resolve(root, "../../packages/agentguard-sdk/src/index.ts"),
      "@rakshex/pricing-engine": path.resolve(root, "../../packages/pricing-engine/src/index.ts"),
    },
  },
});
