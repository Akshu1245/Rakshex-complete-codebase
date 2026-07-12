import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint flat config for the Rakshex monorepo.
 * Apps may extend with local overrides; packages stay under this root config when linted from root.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.next/**",
      "**/out/**",
      "vendor/**",
      "artifacts/**",
      "test-results/**",
      "e2e/**",
      "scripts/**",
      // VS Code extension uses its own tooling
      "apps/vscode-extension/**",
      // Generated / legacy
      "packages/database/drizzle/meta/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-useless-escape": "off",
      "prefer-const": "off",
    },
  },
);
