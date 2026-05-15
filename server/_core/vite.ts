import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { logger } from "./logger";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const nonce = (res.locals as { cspNonce?: string }).cspNonce ?? "";

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // Guard: the project no longer uses a Vite SPA in client/.
      // The frontend is a separate Next.js app under devpulse-frontend/.
      if (!fs.existsSync(clientTemplate)) {
        res
          .status(200)
          .set({ "Content-Type": "text/html" })
          .end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DevPulse API</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
  <h1>DevPulse Backend is running</h1>
  <p>The frontend is a separate Next.js app. Start it with:</p>
  <pre style="background:#f4f4f4;padding:1rem">cd devpulse-frontend && npm run dev</pre>
  <p>API health check: <a href="/api/health">/api/health</a></p>
</body>
</html>`);
        return;
      }

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // Inject CSP nonce into script tags
      template = template.replace(/<script/g, `<script nonce="${nonce}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    logger.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    const nonce = (res.locals as { cspNonce?: string }).cspNonce ?? "";

    // Read and inject CSP nonce into script tags
    fs.readFile(indexPath, "utf-8", (err, data) => {
      if (err) {
        return res.sendFile(indexPath);
      }
      // Add nonce to script tags
      const htmlWithNonce = data.replace(
        /<script/g,
        `<script nonce="${nonce}"`
      );
      res.setHeader("Content-Type", "text/html");
      res.send(htmlWithNonce);
    });
  });
}
