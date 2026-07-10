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
      "vendor/**",
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-useless-escape": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
    },
  }
);
