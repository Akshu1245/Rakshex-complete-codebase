/**
 * Browser Automation Tool — Playwright backend.
 *
 * Navigates a headless Chromium browser to URLs, waits for JavaScript
 * rendering, and extracts page content. Useful for JS-heavy sites,
 * login-gated pages, and interactive content that simple scraping can't reach.
 *
 * Uses Playwright with chromium. Falls back gracefully if Playwright
 * is not installed (returns clear error instead of crashing).
 */

import { ENV } from "../../../_core/env";
import { logger } from "../../../_core/logger";
import { registerTool, BROWSER_TOOL, type McpToolResult } from "./registry";

let playwrightAvailable = false;

async function ensurePlaywright(): Promise<boolean> {
  if (playwrightAvailable) return true;
  try {
    require.resolve("playwright");
    playwrightAvailable = true;
    return true;
  } catch {
    logger.warn("[Research] Playwright not installed — browser navigation disabled");
    return false;
  }
}

interface BrowserResult {
  url: string;
  title: string;
  text?: string;
  html?: string;
  screenshot?: string;
  consoleErrors: string[];
  loadTimeMs: number;
}

registerTool({
  definition: BROWSER_TOOL,
  handler: async (input): Promise<McpToolResult> => {
    const url = input.url as string;
    const waitForSelector = input.wait_for_selector as string | undefined;
    const waitTime = (input.wait_time_ms as number) || 2000;
    const screenshot = input.screenshot as boolean;
    const extractText = input.extract_text !== false;
    const blockImages = input.block_images !== false;
    const blockMedia = input.block_media !== false;

    if (!(await ensurePlaywright())) {
      return {
        content: [{
          type: "text",
          text: "Browser navigation unavailable. Install Playwright: npm install playwright && npx playwright install chromium"
        }],
        isError: true,
      };
    }

    const { chromium } = await import("playwright");
    const startTime = Date.now();
    let browser = null;

    try {
      browser = await chromium.launch({ headless: true });

      const context = await browser.newContext({
        userAgent: "DevPulse-Research/1.0 (compatible; research bot)",
        viewport: { width: 1280, height: 720 },
      });

      const page = await context.newPage();

      // Block heavy resources for speed
      if (blockImages || blockMedia) {
        await page.route("**/*", (route) => {
          const type = route.request().resourceType();
          if ((blockImages && type === "image") || (blockMedia && (type === "media" || type === "font"))) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }

      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 15000 }).catch(() => {});
      }

      if (waitTime > 0) {
        await page.waitForTimeout(waitTime);
      }

      const title = await page.title();
      const loadTimeMs = Date.now() - startTime;

      const result: BrowserResult = {
        url,
        title,
        consoleErrors,
        loadTimeMs,
      };

      if (extractText) {
        result.text = await page.evaluate(() => document.body.innerText);
      }

      if (screenshot) {
        const buffer = await page.screenshot({ fullPage: true, type: "jpeg", quality: 80 });
        result.screenshot = buffer.toString("base64");
      }

      await context.close();

      const formatted = formatBrowserResult(result);
      return { content: [{ type: "text", text: formatted }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err, url }, "[Research] Browser navigation failed");
      return {
        content: [{ type: "text", text: `Browser navigation failed: ${message}` }],
        isError: true,
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  },
});

function formatBrowserResult(result: BrowserResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.title || "Browser Navigation Result"}`);
  lines.push(`*URL: ${result.url} — Loaded in ${result.loadTimeMs}ms*`);
  lines.push("");

  if (result.consoleErrors.length > 0) {
    lines.push(`**Console Errors (${result.consoleErrors.length}):**`);
    result.consoleErrors.slice(0, 5).forEach(e => lines.push(`  - ${e}`));
    lines.push("");
  }

  if (result.text) {
    lines.push("## Page Content");
    lines.push("");
    const truncated = result.text.slice(0, 10000);
    lines.push(truncated);
    if (result.text.length > 10000) {
      lines.push(`\n*... (${result.text.length - 10000} more characters)*`);
    }
  }

  if (result.screenshot) {
    lines.push("");
    lines.push(`## Screenshot`);
    lines.push(`![Screenshot](data:image/jpeg;base64,${result.screenshot.slice(0, 100)}...) [${(result.screenshot.length / 1024).toFixed(1)} KB]`);
  }

  return lines.join("\n");
}
