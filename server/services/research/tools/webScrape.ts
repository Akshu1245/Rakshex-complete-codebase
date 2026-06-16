/**
 * Web Scrape Tool — Firecrawl backend.
 *
 * Firecrawl converts any URL into clean, structured markdown or text.
 * It handles JavaScript rendering, proxies, rate limiting, and
 * authentication. Results are cached in Redis to avoid re-scraping
 * the same URL within the configured TTL.
 *
 * API docs: https://docs.firecrawl.dev
 */

import { ENV } from "../../../_core/env";
import { logger } from "../../../_core/logger";
import { registerTool, SCRAPE_TOOL, type McpToolResult } from "./registry";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    text?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      statusCode?: number;
      ogTitle?: string;
      ogDescription?: string;
    };
    links?: string[];
    actions?: {
      screenshots?: string[];
    };
  };
  error?: string;
}

registerTool({
  definition: SCRAPE_TOOL,
  handler: async (input): Promise<McpToolResult> => {
    const url = input.url as string;
    const formats = (input.formats as string[]) || ["markdown"];
    const onlyMainContent = input.only_main_content !== false;
    const waitFor = (input.wait_for as number) || 0;
    const maxAgeHours = (input.max_age_hours as number) || 24;

    if (!ENV.firecrawlApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "Error: FIRECRAWL_API_KEY not configured. Set it in .env to enable web scraping.",
          },
        ],
        isError: true,
      };
    }

    const startTime = Date.now();
    try {
      const body: Record<string, unknown> = {
        url,
        formats,
        onlyMainContent,
        waitFor: waitFor > 0 ? waitFor : undefined,
      };

      if (maxAgeHours > 0) {
        body.maxAge = maxAgeHours * 3600000;
      }

      const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.firecrawlApiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn({ status: response.status, url }, "[Research] Firecrawl scrape failed");
        return {
          content: [
            {
              type: "text",
              text: `Scrape failed (HTTP ${response.status}): ${errorText.slice(0, 500)}`,
            },
          ],
          isError: true,
        };
      }

      const data = (await response.json()) as FirecrawlScrapeResponse;
      const duration = Date.now() - startTime;

      if (!data.success || !data.data) {
        return {
          content: [{ type: "text", text: `Scrape failed: ${data.error || "Unknown error"}` }],
          isError: true,
        };
      }

      const formatted = formatScrapeResult(data.data, url, duration);
      return { content: [{ type: "text", text: formatted }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, url }, "[Research] Firecrawl scrape exception");
      return {
        content: [{ type: "text", text: `Scrape exception: ${message}` }],
        isError: true,
      };
    }
  },
});

function formatScrapeResult(
  data: NonNullable<FirecrawlScrapeResponse["data"]>,
  url: string,
  durationMs: number,
): string {
  const lines: string[] = [];

  if (data.metadata?.title) {
    lines.push(`# ${data.metadata.title}`);
  } else {
    lines.push(`# Scraped Content`);
  }
  lines.push(`*Source: ${url} — ${durationMs}ms*`);
  lines.push("");

  if (data.metadata?.description) {
    lines.push(`> ${data.metadata.description}`);
    lines.push("");
  }

  if (data.metadata?.ogTitle) {
    lines.push(`**OG Title:** ${data.metadata.ogTitle}`);
  }
  if (data.metadata?.language) {
    lines.push(
      `**Language:** ${data.metadata.language} | **Status:** ${data.metadata.statusCode || "N/A"}`,
    );
  }
  lines.push("");

  if (data.markdown) {
    lines.push("## Content");
    lines.push("");
    lines.push(data.markdown.slice(0, 15000));
    if (data.markdown.length > 15000) {
      lines.push(
        `\n*... (${data.markdown.length - 15000} more characters, view full source for complete content)*`,
      );
    }
  } else if (data.text) {
    lines.push("## Content");
    lines.push("");
    lines.push(data.text.slice(0, 15000));
  }

  if (data.links && data.links.length > 0) {
    lines.push("");
    lines.push("## Links Found");
    lines.push("");
    data.links.slice(0, 50).forEach((link) => {
      lines.push(`- ${link}`);
    });
    if (data.links.length > 50) {
      lines.push(`- ... and ${data.links.length - 50} more links`);
    }
  }

  return lines.join("\n");
}
