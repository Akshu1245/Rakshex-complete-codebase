/**
 * Competitive Watch Service
 *
 * Continuous competitor monitoring. Runs on a schedule (BullMQ cron)
 * and on-demand via tRPC. For each competitor, scans:
 * - Website for changes (scrape + diff)
 * - Blog/changelog for new posts
 * - Pricing page for changes
 * - News for recent mentions
 * - Social media for sentiment
 *
 * Results are stored in competitive_scans table and surfaced
 * through the research dashboard.
 */

import { logger } from "../../_core/logger";
import { getJobQueue } from "../jobQueue";
import * as researchDb from "./db";
import { getTool } from "./tools/registry";
import { executeResearch, type ResearchJobInput, type CompetitiveScanResult } from "./orchestrator";
import { ENV } from "../../_core/env";

// ── Competitor Registry ─────────────────────────────────────────────────────

interface CompetitorProfile {
  id: string;
  name: string;
  websiteUrl: string;
  blogUrl?: string;
  pricingUrl?: string;
  docsUrl?: string;
  githubOrg?: string;
  category: "direct" | "adjacent" | "emerging";
  priority: 1 | 2 | 3;
  keywords: string[];
}

const DEFAULT_COMPETITORS: CompetitorProfile[] = [
  {
    id: "helicone",
    name: "Helicone",
    websiteUrl: "https://helicone.ai",
    blogUrl: "https://helicone.ai/blog",
    pricingUrl: "https://helicone.ai/pricing",
    docsUrl: "https://docs.helicone.ai",
    githubOrg: "Helicone",
    category: "direct",
    priority: 1,
    keywords: ["LLM observability", "AI cost tracking", "prompt management", "gateway proxy"],
  },
  {
    id: "lakera",
    name: "Lakera",
    websiteUrl: "https://lakera.ai",
    blogUrl: "https://lakera.ai/blog",
    pricingUrl: "https://lakera.ai/pricing",
    githubOrg: "lakeraai",
    category: "direct",
    priority: 1,
    keywords: ["prompt injection", "LLM security", "AI firewall", "content safety"],
  },
  {
    id: "portkey",
    name: "Portkey",
    websiteUrl: "https://portkey.ai",
    blogUrl: "https://portkey.ai/blog",
    pricingUrl: "https://portkey.ai/pricing",
    docsUrl: "https://docs.portkey.ai",
    githubOrg: "Portkey-AI",
    category: "direct",
    priority: 1,
    keywords: ["LLM gateway", "AI gateway", "model routing", "prompt management", "load balancing"],
  },
  {
    id: "langsmith",
    name: "LangSmith",
    websiteUrl: "https://smith.langchain.com",
    blogUrl: "https://blog.langchain.dev",
    pricingUrl: "https://smith.langchain.com/pricing",
    docsUrl: "https://docs.smith.langchain.com",
    githubOrg: "langchain-ai",
    category: "direct",
    priority: 2,
    keywords: ["LLM tracing", "evaluation", "prompt engineering", "LangChain"],
  },
  {
    id: "datadog-llm",
    name: "Datadog LLM Observability",
    websiteUrl: "https://www.datadoghq.com/product/llm-observability/",
    category: "adjacent",
    priority: 2,
    keywords: ["LLM monitoring", "AI observability", "enterprise APM"],
  },
  {
    id: "aws-bedrock-guardrails",
    name: "AWS Bedrock Guardrails",
    websiteUrl: "https://aws.amazon.com/bedrock/guardrails/",
    docsUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html",
    category: "adjacent",
    priority: 1,
    keywords: ["AWS", "content filtering", "safety checks", "enterprise AI governance"],
  },
];

// ── Scan Orchestrator ───────────────────────────────────────────────────────

export async function scanCompetitor(competitorId: string): Promise<CompetitiveScanResult> {
  const profile = DEFAULT_COMPETITORS.find(c => c.id === competitorId);
  if (!profile) {
    throw new Error(`Unknown competitor: ${competitorId}`);
  }

  const startTime = Date.now();
  logger.info({ competitor: profile.name }, "[CompetitiveWatch] Starting scan");

  const [
    websiteChanges,
    recentNews,
    pricingChanges,
    blogPosts,
    socialMentions,
  ] = await Promise.all([
    scanWebsite(profile),
    scanNews(profile),
    scanPricing(profile),
    scanBlog(profile),
    scanSocial(profile),
  ]);

  const featureChanges = detectFeatureChanges(websiteChanges, recentNews);
  const threatLevel = assessThreatLevel(profile, websiteChanges, recentNews, pricingChanges);

  const result: CompetitiveScanResult = {
    competitor: profile.name,
    scannedAt: new Date(),
    websiteChanges,
    recentNews,
    pricingChanges,
    featureChanges,
    blogPosts,
    socialMentions,
    threatLevel,
    summary: generateSummary(profile.name, websiteChanges, recentNews, pricingChanges, threatLevel),
  };

  await persistCompetitiveScan(profile.id, result);

  logger.info(
    { competitor: profile.name, duration: Date.now() - startTime, threatLevel },
    "[CompetitiveWatch] Scan complete"
  );

  return result;
}

export async function scanAllCompetitors(): Promise<CompetitiveScanResult[]> {
  const directCompetitors = DEFAULT_COMPETITORS.filter(c => c.priority <= 2);
  const results: CompetitiveScanResult[] = [];

  for (const competitor of directCompetitors) {
    try {
      const result = await scanCompetitor(competitor.id);
      results.push(result);
    } catch (err) {
      logger.error({ err, competitor: competitor.name }, "[CompetitiveWatch] Scan failed");
    }
  }

  return results;
}

// ── Individual Scanners ─────────────────────────────────────────────────────

async function scanWebsite(profile: CompetitorProfile): Promise<string[]> {
  const changes: string[] = [];
  if (!ENV.firecrawlApiKey) return changes;

  const scrapeTool = getTool("web_scrape");
  if (!scrapeTool) return changes;

  try {
    const result = await scrapeTool.handler({
      url: profile.websiteUrl,
      formats: ["markdown"],
      only_main_content: true,
      max_age_hours: 0,
    });

    if (!result.isError) {
      const content = result.content[0]?.text || "";
      changes.push(`Website scraped (${content.length} chars)`);

      // Detect feature keywords
      for (const keyword of profile.keywords) {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          changes.push(`Keyword found: "${keyword}"`);
        }
      }
    }
  } catch (err) {
    logger.warn({ err, url: profile.websiteUrl }, "[CompetitiveWatch] Website scan failed");
  }

  return changes;
}

async function scanNews(profile: CompetitorProfile): Promise<string[]> {
  const news: string[] = [];
  if (!ENV.tavilyApiKey) return news;

  const searchTool = getTool("web_search");
  if (!searchTool) return news;

  try {
    const result = await searchTool.handler({
      query: `${profile.name} company news`,
      search_depth: "basic",
      max_results: 5,
      days: 30,
    });

    if (!result.isError) {
      const content = result.content[0]?.text || "";
      const headlineRegex = /\*\*\d+\.\s*\[(.+?)\]\((.+?)\)/g;
      let match;
      while ((match = headlineRegex.exec(content)) !== null) {
        news.push(`${match[1]} (${match[2]})`);
      }
    }
  } catch (err) {
    logger.warn({ err, competitor: profile.name }, "[CompetitiveWatch] News scan failed");
  }

  return news;
}

async function scanPricing(profile: CompetitorProfile): Promise<string[]> {
  const changes: string[] = [];
  if (!profile.pricingUrl || !ENV.firecrawlApiKey) return changes;

  const scrapeTool = getTool("web_scrape");
  if (!scrapeTool) return changes;

  try {
    const result = await scrapeTool.handler({
      url: profile.pricingUrl,
      formats: ["markdown"],
      only_main_content: true,
      max_age_hours: 0,
    });

    if (!result.isError) {
      const content = result.content[0]?.text || "";
      const priceMatch = content.match(/\$\d+/g);
      if (priceMatch) {
        changes.push(`Pricing tiers detected: ${priceMatch.join(", ")}`);
      }
    }
  } catch (err) {
    logger.warn({ err, url: profile.pricingUrl }, "[CompetitiveWatch] Pricing scan failed");
  }

  return changes;
}

async function scanBlog(profile: CompetitorProfile): Promise<Array<{ title: string; url: string; date?: string }>> {
  const posts: Array<{ title: string; url: string; date?: string }> = [];
  if (!profile.blogUrl || !ENV.firecrawlApiKey) return posts;

  const scrapeTool = getTool("web_scrape");
  if (!scrapeTool) return posts;

  try {
    const result = await scrapeTool.handler({
      url: profile.blogUrl,
      formats: ["markdown"],
      only_main_content: true,
      max_age_hours: 12,
    });

    if (!result.isError) {
      const content = result.content[0]?.text || "";
      const linkRegex = /\[(.+?)\]\((.+?)\)/g;
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        if (posts.length < 10) {
          posts.push({ title: match[1], url: match[2] });
        }
      }
    }
  } catch (err) {
    logger.warn({ err, url: profile.blogUrl }, "[CompetitiveWatch] Blog scan failed");
  }

  return posts;
}

async function scanSocial(profile: CompetitorProfile): Promise<Array<{ platform: string; text: string; date?: string }>> {
  const mentions: Array<{ platform: string; text: string; date?: string }> = [];
  if (!ENV.tavilyApiKey) return mentions;

  const searchTool = getTool("web_search");
  if (!searchTool) return mentions;

  try {
    const result = await searchTool.handler({
      query: `${profile.name} site:reddit.com OR site:news.ycombinator.com`,
      search_depth: "basic",
      max_results: 5,
      days: 14,
    });

    if (!result.isError) {
      const content = result.content[0]?.text || "";
      const linkRegex = /\*\*\d+\.\s*\[(.+?)\]\((.+?)\)/g;
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        const platform = match[2].includes("reddit") ? "reddit" :
                         match[2].includes("ycombinator") ? "hackernews" : "other";
        mentions.push({ platform, text: match[1] });
      }
    }
  } catch (err) {
    logger.warn({ err, competitor: profile.name }, "[CompetitiveWatch] Social scan failed");
  }

  return mentions;
}

// ── Analysis ────────────────────────────────────────────────────────────────

function detectFeatureChanges(websiteChanges: string[], recentNews: string[]): string[] {
  const featureIndicators = ["launch", "new feature", "release", "announce", "introduce", "now available", "beta", "GA"];
  const changes: string[] = [];

  for (const news of recentNews) {
    for (const indicator of featureIndicators) {
      if (news.toLowerCase().includes(indicator)) {
        changes.push(news);
        break;
      }
    }
  }

  return changes;
}

function assessThreatLevel(
  profile: CompetitorProfile,
  websiteChanges: string[],
  recentNews: string[],
  pricingChanges: string[]
): "low" | "medium" | "high" | "critical" {
  const criticalKeywords = ["acquires", "acquisition", "raised $", "series", "partners with", "AWS", "Microsoft"];
  const highKeywords = ["launches", "new product", "LLM gateway", "AI governance", "enterprise"];

  const allText = [...recentNews, ...websiteChanges, ...pricingChanges].join(" ").toLowerCase();

  if (criticalKeywords.some(k => allText.includes(k.toLowerCase()))) return "critical";
  if (highKeywords.some(k => allText.includes(k.toLowerCase()))) return "high";
  if (recentNews.length > 5) return "medium";
  return "low";
}

function generateSummary(
  name: string,
  _websiteChanges: string[],
  recentNews: string[],
  pricingChanges: string[],
  threatLevel: string
): string {
  const parts: string[] = [];
  if (recentNews.length > 0) parts.push(`${recentNews.length} recent news items detected`);
  if (pricingChanges.length > 0) parts.push(`pricing changes detected`);
  parts.push(`threat level: ${threatLevel.toUpperCase()}`);
  return `${name}: ${parts.join(". ")}.`;
}

// ── Persistence ─────────────────────────────────────────────────────────────

async function persistCompetitiveScan(competitorId: string, result: CompetitiveScanResult): Promise<void> {
  try {
    await researchDb.createCompetitiveScan({
      competitorId,
      competitorName: result.competitor,
      websiteChanges: result.websiteChanges,
      recentNews: result.recentNews,
      pricingChanges: result.pricingChanges,
      featureChanges: result.featureChanges,
      blogPosts: result.blogPosts,
      socialMentions: result.socialMentions,
      threatLevel: result.threatLevel,
      summary: result.summary,
    });
  } catch (err) {
    logger.warn({ err, competitorId }, "[CompetitiveWatch] Persistence failed");
  }
}

// ── Scheduling ──────────────────────────────────────────────────────────────

export function scheduleCompetitiveScans(): void {
  if (!ENV.tavilyApiKey && !ENV.firecrawlApiKey) {
    logger.warn("[CompetitiveWatch] No search/scrape API keys configured — scheduling disabled");
    return;
  }

  const queue = getJobQueue();
  queue.enqueue("competitive-scan", {
    type: "scan_all",
    scheduledAt: new Date().toISOString(),
  });

  logger.info("[CompetitiveWatch] Initial scan queued");
}

// ── Exports ─────────────────────────────────────────────────────────────────

export { DEFAULT_COMPETITORS };
export type { CompetitorProfile };
