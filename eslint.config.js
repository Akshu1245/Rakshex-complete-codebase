import js from "@eslint/js";
import tseslint from "typescript-eslint";

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
      "devpulse-frontend/**",
      "devpulse-vscode/**",
      "rakshex-frontend/**",
      "rakshex-vscode/**",
      "scripts/**",
      "insforge-clone/**",
      "insforge-mirror/**",
      "packages/**",
      "vscode-extension/**",
      "web-demo/**",
      "backend/**",
      "github-action/**",
      "drizzle/**",
      "e2e/**",
      "marketing/**",
      "test-labs/**",
      "pitch-deck/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "preserve-caught-error": "off",
    },
  }
);