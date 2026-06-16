// @ts-nocheck
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Ship no source maps to production. Makes the deployed JS
    // significantly harder to reverse-engineer back to original
    // TypeScript + keeps dependency names + internal paths out of
    // DevTools. If we ever need prod debugging we can re-emit maps
    // for an internal tool only.
    sourcemap: false,
    // esbuild minification is ~20x faster than terser for the same
    // size. Good enough for a modern bundle and it mangles identifiers.
    minify: "esbuild",
    target: "es2020",
    rollupOptions: {
      output: {
        // Stable chunk + asset names without paths — additional layer
        // of obscurity in network inspectors.
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
      },
    },
  },
  esbuild: {
    // Strip `console.*` and `debugger` statements from the production
    // bundle. Saves bytes *and* removes a juicy source of information
    // leakage for anyone poking at the deployed JS.
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    // Strip comments from JSX/TSX — no need to ship them to browsers.
    legalComments: "none",
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
