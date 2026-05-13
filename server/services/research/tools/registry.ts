/**
 * Research MCP Tools Registry
 *
 * Exposes web search, scraping, and browser automation as MCP tools
 * that can be discovered and invoked by any agent or the Security Copilot.
 *
 * Tools follow the MCP specification: name, description, inputSchema.
 * Each tool is a thin wrapper that validates inputs and delegates to
 * the appropriate backend (Tavily, Firecrawl, Playwright).
 */

import { z } from "zod";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export type McpToolHandler = (input: Record<string, unknown>) => Promise<McpToolResult>;

export interface McpTool {
  definition: McpToolDefinition;
  handler: McpToolHandler;
}

// ── Tool Registry ───────────────────────────────────────────────────────────

const toolRegistry = new Map<string, McpTool>();

export function registerTool(tool: McpTool): void {
  toolRegistry.set(tool.definition.name, tool);
}

export function getTool(name: string): McpTool | undefined {
  return toolRegistry.get(name);
}

export function listTools(): McpToolDefinition[] {
  return Array.from(toolRegistry.values()).map(t => t.definition);
}

// ── Tool Definitions ────────────────────────────────────────────────────────

export const SEARCH_TOOL: McpToolDefinition = {
  name: "web_search",
  description:
    "Search the web using Tavily AI-powered search. Returns structured results with titles, URLs, content snippets, and relevance scores. Best for research queries, fact-finding, and competitive intelligence gathering. Use 'search_depth: advanced' for comprehensive results.",
  inputSchema: z.object({
    query: z.string().min(1).max(400).describe("The search query"),
    search_depth: z.enum(["basic", "advanced"]).default("basic").describe("basic = fast (1 credit), advanced = comprehensive (2 credits)"),
    max_results: z.number().int().min(1).max(20).default(10).describe("Number of results to return"),
    include_domains: z.array(z.string()).optional().describe("Only include results from these domains"),
    exclude_domains: z.array(z.string()).optional().describe("Exclude results from these domains"),
    days: z.number().int().min(1).max(365).optional().describe("Only include results from the last N days"),
  }),
};

export const SCRAPE_TOOL: McpToolDefinition = {
  name: "web_scrape",
  description:
    "Scrape and extract clean content from any URL. Uses Firecrawl to convert web pages into structured markdown or text. Handles JavaScript-rendered pages, authentication, and rate limiting. Returns the full page content, metadata, and links.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to scrape"),
    formats: z.array(z.enum(["markdown", "html", "text"])).default(["markdown"]).describe("Output formats"),
    only_main_content: z.boolean().default(true).describe("Extract only the main content, skip navigation/footer"),
    wait_for: z.number().int().min(0).max(30000).default(0).describe("Wait N milliseconds for JS to render before scraping"),
    max_age_hours: z.number().int().min(0).max(720).default(24).describe("Maximum age of cached result in hours (0 = always fresh)"),
  }),
};

export const BROWSER_TOOL: McpToolDefinition = {
  name: "browser_navigate",
  description:
    "Navigate a headless browser to a URL and extract the rendered page. Useful for JavaScript-heavy sites, login-gated content, and interactive pages. Returns the page text, HTML, screenshot (optional), and any console errors.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to navigate to"),
    wait_for_selector: z.string().optional().describe("CSS selector to wait for before capturing content"),
    wait_time_ms: z.number().int().min(0).max(30000).default(2000).describe("Additional wait time after page load"),
    screenshot: z.boolean().default(false).describe("Capture a full-page screenshot"),
    extract_text: z.boolean().default(true).describe("Extract visible text content"),
    block_images: z.boolean().default(true).describe("Block images for faster loading"),
    block_media: z.boolean().default(true).describe("Block video/audio for faster loading"),
  }),
};

export const COMPETITOR_SCAN_TOOL: McpToolDefinition = {
  name: "competitor_scan",
  description:
    "Perform a comprehensive competitor scan: checks their website for changes, searches for recent news, monitors their blog/changelog, and detects pricing updates. Returns a structured intelligence report.",
  inputSchema: z.object({
    competitor_name: z.string().min(1).describe("Name of the competitor to scan"),
    website_url: z.string().url().describe("Competitor's main website URL"),
    blog_url: z.string().url().optional().describe("Competitor's blog/changelog URL"),
    pricing_url: z.string().url().optional().describe("Competitor's pricing page URL"),
    check_social: z.boolean().default(false).describe("Search for recent social media mentions"),
    check_news: z.boolean().default(true).describe("Search for recent news articles"),
  }),
};

export const RESEARCH_SYNTHESIS_TOOL: McpToolDefinition = {
  name: "research_synthesis",
  description:
    "Synthesize multiple research sources into a structured report. Takes URLs, search queries, or raw text and produces an executive summary, key findings, source citations, confidence scores, and actionable recommendations.",
  inputSchema: z.object({
    topic: z.string().min(1).max(200).describe("The research topic"),
    sources: z.array(z.string().url()).optional().describe("Specific URLs to analyze"),
    search_queries: z.array(z.string()).optional().describe("Search queries to find additional sources"),
    depth: z.enum(["quick", "standard", "deep"]).default("standard").describe("Research depth: quick (5 min), standard (15 min), deep (30+ min)"),
    max_sources: z.number().int().min(1).max(50).default(15).describe("Maximum number of sources to analyze"),
    include_competitors: z.boolean().default(false).describe("Include competitor analysis"),
    include_trends: z.boolean().default(false).describe("Include trend analysis"),
    include_sentiment: z.boolean().default(false).describe("Include sentiment analysis"),
  }),
};

export const MARKET_TREND_TOOL: McpToolDefinition = {
  name: "market_trend_scan",
  description:
    "Scan for market trends in a specific industry or technology domain. Analyzes news, social media, funding announcements, and product launches to identify emerging patterns, shifts, and opportunities.",
  inputSchema: z.object({
    domain: z.string().min(1).describe("Industry or technology domain to scan (e.g., 'LLM observability', 'AI security')"),
    sources: z.array(z.enum(["news", "twitter", "reddit", "linkedin", "github", "producthunt"])).default(["news", "reddit", "github"]),
    time_range_days: z.number().int().min(1).max(90).default(30),
    max_items: z.number().int().min(5).max(100).default(25),
  }),
};
