/**
 * Research Module — Database service layer
 *
 * Provides persistence for research results, competitive scans,
 * and research memory. Uses the existing getDb() connection pool.
 */

import { getDb } from "../../db";
import { logger } from "../../_core/logger";
import { sql } from "drizzle-orm";

export interface ResearchMemoryRow {
  id: number;
  userId: number;
  topic: string;
  summary: string;
  sources: string[];
  findings: string[];
  confidenceScore: number;
  sourceCount: number;
  createdAt: Date;
}

export interface CompetitiveScanRow {
  id: number;
  competitorId: string;
  competitorName: string;
  websiteChanges: string[];
  recentNews: string[];
  pricingChanges: string[];
  featureChanges: string[];
  blogPosts: Array<{ title: string; url: string; date?: string }>;
  socialMentions: Array<{ platform: string; text: string; date?: string }>;
  threatLevel: string;
  summary: string;
  scannedAt: Date;
  createdAt: Date;
}

// ── Research Memory CRUD ────────────────────────────────────────────────────

export async function createResearchMemory(params: {
  userId: number;
  topic: string;
  summary: string;
  sources: string[];
  findings: string[];
  confidenceScore: number;
  sourceCount: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql`
    INSERT INTO research_memory (user_id, topic, summary, sources, findings, confidence_score, source_count, created_at)
    VALUES (${params.userId}, ${params.topic}, ${params.summary}, ${JSON.stringify(params.sources)}, ${JSON.stringify(params.findings)}, ${params.confidenceScore}, ${params.sourceCount}, NOW())
    RETURNING id
  `);

  return (result.rows[0] as { id: number }).id;
}

export async function getResearchMemory(
  userId: number,
  limit = 10,
  offset = 0,
): Promise<ResearchMemoryRow[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT id, user_id, topic, summary, sources, findings, confidence_score, source_count, created_at
    FROM research_memory
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return (result.rows as Array<Record<string, unknown>>).map(mapResearchMemoryRow);
}

export async function searchResearchMemory(
  userId: number,
  query: string,
  limit = 10,
): Promise<ResearchMemoryRow[]> {
  const db = await getDb();
  if (!db) return [];

  const searchTerm = `%${query}%`;
  const result = await db.execute(sql`
    SELECT id, user_id, topic, summary, sources, findings, confidence_score, source_count, created_at
    FROM research_memory
    WHERE user_id = ${userId} AND (topic LIKE ${searchTerm} OR summary LIKE ${searchTerm})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return (result.rows as Array<Record<string, unknown>>).map(mapResearchMemoryRow);
}

// ── Competitive Scan CRUD ───────────────────────────────────────────────────

export async function createCompetitiveScan(params: {
  competitorId: string;
  competitorName: string;
  websiteChanges: string[];
  recentNews: string[];
  pricingChanges: string[];
  featureChanges: string[];
  blogPosts: Array<{ title: string; url: string; date?: string }>;
  socialMentions: Array<{ platform: string; text: string; date?: string }>;
  threatLevel: string;
  summary: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql`
    INSERT INTO competitive_scans (competitor_id, competitor_name, website_changes, recent_news, pricing_changes, feature_changes, blog_posts, social_mentions, threat_level, summary, scanned_at, created_at)
    VALUES (${params.competitorId}, ${params.competitorName}, ${JSON.stringify(params.websiteChanges)}, ${JSON.stringify(params.recentNews)}, ${JSON.stringify(params.pricingChanges)}, ${JSON.stringify(params.featureChanges)}, ${JSON.stringify(params.blogPosts)}, ${JSON.stringify(params.socialMentions)}, ${params.threatLevel}, ${params.summary}, NOW(), NOW())
    RETURNING id
  `);

  return (result.rows[0] as { id: number }).id;
}

export async function getLatestCompetitiveScan(
  competitorId: string,
): Promise<CompetitiveScanRow | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.execute(sql`
    SELECT * FROM competitive_scans
    WHERE competitor_id = ${competitorId}
    ORDER BY scanned_at DESC
    LIMIT 1
  `);

  const rows = result.rows as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  return mapCompetitiveScanRow(rows[0]);
}

export async function getCompetitiveScanHistory(
  competitorId: string,
  limit = 10,
): Promise<CompetitiveScanRow[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT * FROM competitive_scans
    WHERE competitor_id = ${competitorId}
    ORDER BY scanned_at DESC
    LIMIT ${limit}
  `);

  return (result.rows as Array<Record<string, unknown>>).map(mapCompetitiveScanRow);
}

// ── Row Mappers ─────────────────────────────────────────────────────────────

function mapResearchMemoryRow(row: Record<string, unknown>): ResearchMemoryRow {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    topic: row.topic as string,
    summary: row.summary as string,
    sources: parseJsonArray(row.sources),
    findings: parseJsonArray(row.findings),
    confidenceScore: row.confidence_score as number,
    sourceCount: row.source_count as number,
    createdAt: new Date(row.created_at as string),
  };
}

function mapCompetitiveScanRow(row: Record<string, unknown>): CompetitiveScanRow {
  return {
    id: row.id as number,
    competitorId: row.competitor_id as string,
    competitorName: row.competitor_name as string,
    websiteChanges: parseJsonArray(row.website_changes),
    recentNews: parseJsonArray(row.recent_news),
    pricingChanges: parseJsonArray(row.pricing_changes),
    featureChanges: parseJsonArray(row.feature_changes),
    blogPosts: parseJsonArray(row.blog_posts) as unknown as Array<{
      title: string;
      url: string;
      date?: string;
    }>,
    socialMentions: parseJsonArray(row.social_mentions) as unknown as Array<{
      platform: string;
      text: string;
      date?: string;
    }>,
    threatLevel: row.threat_level as string,
    summary: row.summary as string,
    scannedAt: new Date(row.scanned_at as string),
    createdAt: new Date(row.created_at as string),
  };
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  try {
    const parsed = JSON.parse(value as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
