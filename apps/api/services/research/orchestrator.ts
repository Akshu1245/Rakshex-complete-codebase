/**
 * Research Orchestrator Service
 *
 * Coordinates multi-step research workflows. Breaks complex research
 * questions into parallel search + scrape + synthesis operations.
 * Uses the MCP tool layer (web_search, web_scrape, browser_navigate)
 * and coordinates results through BullMQ for reliability.
 *
 * Architecture:
 *   Research Job (BullMQ)
 *     ├── Phase 1: Parallel web searches (N queries)
 *     ├── Phase 2: Parallel scrapes (top K URLs per search)
 *     ├── Phase 3: LLM synthesis (via _core/llm.ts)
 *     └── Phase 4: Memory persistence (research_memory table)
 */

import { logger } from "../../_core/logger";
import { getJobQueue } from "../jobQueue";
import * as researchDb from "./db";
import { getTool } from "./tools/registry";
import { ENV } from "../../_core/env";

export interface ResearchJobInput {
  topic: string;
  searchQueries: string[];
  specificUrls?: string[];
  depth: "quick" | "standard" | "deep";
  maxSources: number;
  includeCompetitors: boolean;
  includeTrends: boolean;
  userId?: number;
  workspaceId?: number;
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  fullContent?: string;
  relevanceScore: number;
  publishedDate?: string;
  domain: string;
}

export interface ResearchReport {
  id: string;
  topic: string;
  executiveSummary: string;
  keyFindings: string[];
  sources: ResearchSource[];
  competitorAnalysis?: string;
  trendAnalysis?: string;
  confidenceScore: number;
  generatedAt: Date;
  queryCount: number;
  messageCount: number;
}

export interface CompetitiveScanResult {
  competitor: string;
  scannedAt: Date;
  websiteChanges: string[];
  recentNews: string[];
  pricingChanges: string[];
  featureChanges: string[];
  blogPosts: Array<{ title: string; url: string; date?: string }>;
  socialMentions: Array<{ platform: string; text: string; date?: string }>;
  threatLevel: "low" | "medium" | "high" | "critical";
  summary: string;
}

// ── Main Orchestrator ───────────────────────────────────────────────────────

export async function executeResearch(input: ResearchJobInput): Promise<ResearchReport> {
  const startTime = Date.now();
  logger.info({ topic: input.topic, depth: input.depth }, "[Research] Starting research job");

  // Phase 1: Execute all search queries in parallel
  const searchResults = await executeParallelSearches(input.searchQueries, input.depth);

  // Phase 2: Scrape top URLs from search results
  const allUrls = collectTopUrls(searchResults, input.maxSources, input.specificUrls);
  const scrapedSources = await executeParallelScrapes(allUrls, input.depth);

  // Phase 3: Synthesize with LLM
  const synthesis = await synthesizeResearch(input.topic, scrapedSources, input);

  // Phase 4: Persist to memory
  const report: ResearchReport = {
    id: `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic: input.topic,
    executiveSummary: synthesis.summary,
    keyFindings: synthesis.findings,
    sources: scrapedSources,
    competitorAnalysis: synthesis.competitorAnalysis,
    trendAnalysis: synthesis.trendAnalysis,
    confidenceScore: synthesis.confidenceScore,
    generatedAt: new Date(),
    queryCount: input.searchQueries.length,
    messageCount: synthesis.messageCount,
  };

  if (input.userId) {
    await researchDb
      .createResearchMemory({
        userId: input.userId,
        topic: input.topic,
        summary: report.executiveSummary,
        sources: report.sources.map((s) => s.url),
        findings: report.keyFindings,
        confidenceScore: report.confidenceScore,
        sourceCount: report.sources.length,
      })
      .catch((err) => {
        logger.warn({ err }, "[Research] Failed to persist memory");
      });
  }

  logger.info(
    { topic: input.topic, sources: scrapedSources.length, duration: Date.now() - startTime },
    "[Research] Job complete",
  );

  return report;
}

// ── Phase 1: Parallel Searches ─────────────────────────────────────────────

async function executeParallelSearches(
  queries: string[],
  depth: string,
): Promise<Map<string, Array<{ url: string; title: string; snippet: string; score: number }>>> {
  const results = new Map<
    string,
    Array<{ url: string; title: string; snippet: string; score: number }>
  >();
  const searchTool = getTool("web_search");

  if (!searchTool || !ENV.tavilyApiKey) {
    logger.warn("[Research] Web search tool not available — using empty results");
    return results;
  }

  const maxResults = depth === "deep" ? 15 : depth === "quick" ? 5 : 10;
  const searchDepth = depth === "deep" ? "advanced" : "basic";

  const searchPromises = queries.map(async (query) => {
    try {
      const result = await searchTool.handler({
        query,
        search_depth: searchDepth,
        max_results: maxResults,
      });

      if (result.isError) {
        logger.warn(
          { query, error: result.content[0]?.text },
          "[Research] Search failed for query",
        );
        return;
      }

      const parsed = parseSearchResults(result.content[0]?.text || "");
      results.set(query, parsed);
    } catch (err) {
      logger.warn({ err, query }, "[Research] Search exception");
    }
  });

  await Promise.all(searchPromises);
  return results;
}

function parseSearchResults(
  text: string,
): Array<{ url: string; title: string; snippet: string; score: number }> {
  const results: Array<{ url: string; title: string; snippet: string; score: number }> = [];
  const lines = text.split("\n");
  let currentItem: Partial<{ url: string; title: string; snippet: string; score: number }> = {};

  for (const line of lines) {
    const match = line.match(/^\*\*\d+\.\s*\[(.+?)\]\((.+?)\)\*\*\s*—\s*Relevance:\s*(\d+)%/);
    if (match) {
      if (currentItem.url)
        results.push(currentItem as { url: string; title: string; snippet: string; score: number });
      currentItem = { title: match[1], url: match[2], score: parseInt(match[3]) / 100 };
    } else if (line.trim().startsWith("   ") && currentItem.url && !currentItem.snippet) {
      currentItem.snippet = line.trim();
    }
  }
  if (currentItem.url)
    results.push(currentItem as { url: string; title: string; snippet: string; score: number });

  return results;
}

function collectTopUrls(
  searchResults: Map<string, Array<{ url: string; title: string; snippet: string; score: number }>>,
  maxSources: number,
  specificUrls?: string[],
): string[] {
  const allUrls = new Map<string, { title: string; snippet: string; score: number }>();

  for (const results of searchResults.values()) {
    for (const r of results) {
      const existing = allUrls.get(r.url);
      if (!existing || r.score > existing.score) {
        allUrls.set(r.url, { title: r.title, snippet: r.snippet, score: r.score });
      }
    }
  }

  const sorted = Array.from(allUrls.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, maxSources);

  const urls = sorted.map(([url]) => url);

  if (specificUrls) {
    for (const url of specificUrls) {
      if (!urls.includes(url) && urls.length < maxSources) {
        urls.push(url);
      }
    }
  }

  return urls;
}

// ── Phase 2: Parallel Scrapes ──────────────────────────────────────────────

async function executeParallelScrapes(urls: string[], depth: string): Promise<ResearchSource[]> {
  const scrapeTool = getTool("web_scrape");
  const sources: ResearchSource[] = [];

  if (!scrapeTool || !ENV.firecrawlApiKey) {
    logger.warn("[Research] Scrape tool not available");
    return sources;
  }

  const maxConcurrency = depth === "deep" ? 10 : 5;
  const batches = chunkArray(urls, maxConcurrency);

  for (const batch of batches) {
    const batchPromises = batch.map(async (url) => {
      try {
        const result = await scrapeTool.handler({
          url,
          formats: ["markdown"],
          only_main_content: true,
          max_age_hours: depth === "deep" ? 0 : 24,
        });

        if (!result.isError) {
          sources.push({
            url,
            title: extractTitleFromContent(result.content[0]?.text || "", url),
            snippet: "",
            fullContent: result.content[0]?.text || "",
            relevanceScore: 1.0,
            domain: new URL(url).hostname,
          });
        }
      } catch (err) {
        logger.warn({ err, url }, "[Research] Scrape exception");
      }
    });

    await Promise.all(batchPromises);
  }

  return sources;
}

function extractTitleFromContent(content: string, fallbackUrl: string): string {
  const h1Match = content.match(/^#\s+(.+)/m);
  if (h1Match) return h1Match[1];
  try {
    return new URL(fallbackUrl).hostname;
  } catch {
    return fallbackUrl;
  }
}

// ── Phase 3: LLM Synthesis ─────────────────────────────────────────────────

async function synthesizeResearch(
  topic: string,
  sources: ResearchSource[],
  input: ResearchJobInput,
): Promise<{
  summary: string;
  findings: string[];
  competitorAnalysis?: string;
  trendAnalysis?: string;
  confidenceScore: number;
  messageCount: number;
}> {
  const sourceTexts = sources
    .map(
      (s, i) =>
        `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n${(s.fullContent || s.snippet).slice(0, 3000)}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are a senior research analyst. Synthesize the following sources into a structured research report.

TOPIC: ${topic}
DEPTH: ${input.depth}
SOURCES ANALYZED: ${sources.length}

SOURCE MATERIAL:
${sourceTexts}

Generate a JSON response with these fields:
{
  "summary": "2-3 paragraph executive summary",
  "findings": ["key finding 1", "key finding 2", ...],
  ${input.includeCompetitors ? '"competitorAnalysis": "competitive landscape analysis",' : ""}
  ${input.includeTrends ? '"trendAnalysis": "trend analysis and predictions",' : ""}
  "confidenceScore": 0-100
}`;

  try {
    const { invokeLLM } = await import("../../_core/llm");
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a senior research analyst. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });

    const choice = response.choices?.[0];
    if (!choice) throw new Error("No response from LLM");
    const text =
      typeof choice.message.content === "string"
        ? choice.message.content
        : (choice.message.content as Array<{ type: string; text?: string }>)
            .map((c) => c.text || "")
            .join("");

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    return {
      summary: (parsed.summary as string) || text.slice(0, 1000),
      findings: (parsed.findings as string[]) || [],
      competitorAnalysis: parsed.competitorAnalysis as string | undefined,
      trendAnalysis: parsed.trendAnalysis as string | undefined,
      confidenceScore: (parsed.confidenceScore as number) || 70,
      messageCount: 1,
    };
  } catch (err) {
    logger.warn({ err, topic }, "[Research] LLM synthesis failed, using heuristic summary");
    return {
      summary: `Research on "${topic}" analyzed ${sources.length} sources. Results are available for review.`,
      findings: sources.slice(0, 5).map((s) => s.title),
      confidenceScore: 30,
      messageCount: 0,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export async function enqueueResearchJob(input: ResearchJobInput): Promise<string> {
  const jobId = `research_${Date.now()}`;
  const queue = getJobQueue();

  await queue.enqueue("research", {
    jobId,
    input,
    queuedAt: new Date().toISOString(),
  });

  logger.info({ jobId, topic: input.topic }, "[Research] Job queued");
  return jobId;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
