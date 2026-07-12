/**
 * Web Search Tool — Tavily AI-powered search backend.
 *
 * Tavily is purpose-built for AI agent research (not general web search).
 * It returns structured results with content snippets, relevance scores,
 * and raw content that agents can consume directly without scraping.
 *
 * API docs: https://docs.tavily.com
 */

import { ENV } from "../../../_core/env";
import { logger } from "../../../_core/logger";
import { registerTool, SEARCH_TOOL, type McpToolResult } from "./registry";

const TAVILY_API_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
  published_date?: string;
}

interface TavilyResponse {
  query: string;
  results: TavilyResult[];
  answer?: string;
  response_time: number;
  images?: Array<{ url: string; description?: string }>;
}

registerTool({
  definition: SEARCH_TOOL,
  handler: async (input): Promise<McpToolResult> => {
    const query = input.query as string;
    const searchDepth = (input.search_depth as string) || "basic";
    const maxResults = (input.max_results as number) || 10;
    const includeDomains = input.include_domains as string[] | undefined;
    const excludeDomains = input.exclude_domains as string[] | undefined;
    const days = input.days as number | undefined;

    if (!ENV.tavilyApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "Error: TAVILY_API_KEY not configured. Set it in .env to enable web search.",
          },
        ],
        isError: true,
      };
    }

    const startTime = Date.now();
    try {
      const body: Record<string, unknown> = {
        api_key: ENV.tavilyApiKey,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_answer: searchDepth === "advanced",
        include_raw_content: searchDepth === "advanced",
        include_images: false,
        include_domains: includeDomains,
        exclude_domains: excludeDomains,
      };

      if (days) {
        (body as Record<string, unknown>).days = days;
      }

      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(
          { status: response.status, error: errorText },
          "[Research] Tavily search failed",
        );
        return {
          content: [
            {
              type: "text",
              text: `Search failed (HTTP ${response.status}): ${errorText.slice(0, 500)}`,
            },
          ],
          isError: true,
        };
      }

      const data = (await response.json()) as TavilyResponse;
      const duration = Date.now() - startTime;

      const formatted = formatSearchResults(data, query, duration);
      return { content: [{ type: "text", text: formatted }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, query }, "[Research] Tavily search exception");
      return {
        content: [{ type: "text", text: `Search exception: ${message}` }],
        isError: true,
      };
    }
  },
});

function formatSearchResults(data: TavilyResponse, query: string, durationMs: number): string {
  const lines: string[] = [];
  lines.push(`## Web Search Results: "${query}"`);
  lines.push(`*${data.results.length} results in ${durationMs}ms*`);
  lines.push("");

  if (data.answer) {
    lines.push("### AI-Generated Answer");
    lines.push(data.answer);
    lines.push("");
  }

  lines.push("### Results");
  data.results.forEach((r, i) => {
    lines.push(`**${i + 1}. [${r.title}](${r.url})** — Relevance: ${Math.round(r.score * 100)}%`);
    if (r.published_date) lines.push(`   *Published: ${r.published_date}*`);
    lines.push(`   ${r.content.slice(0, 500)}`);
    if (r.raw_content) {
      lines.push(
        `   <details><summary>Full content</summary>${r.raw_content.slice(0, 2000)}</details>`,
      );
    }
    lines.push("");
  });

  return lines.join("\n");
}
