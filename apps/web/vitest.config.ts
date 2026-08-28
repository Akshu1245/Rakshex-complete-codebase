import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
  plugins: [
    {
      name: "md-as-string",
      transform(code, id) {
        if (id.endsWith(".md")) {
          return { code: `export default ${JSON.stringify(code)}`, map: null };
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
