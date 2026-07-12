/**
 * REST endpoint for GitHub Action / CI:
 *   POST /api/github/scan
 * Auth: Authorization: Bearer <api-key> or x-api-key
 * Body: { openapiPath?, postmanPath?, openapiContent?, postmanContent?, repository?, prNumber?, headSha? }
 * Returns findings + SARIF + counts for Action exit codes.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { runScan, calculateRiskScore, getRiskLevel } from "@rakshex/scanner-core";
import * as db from "../db";
import { logger } from "../_core/logger";
import { redis } from "../_core/cache";

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24h

async function resolveUser(req: Request) {
  const apiKey =
    (req.headers["x-api-key"] as string) ||
    (typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : undefined);
  if (!apiKey) return null;
  try {
    const { validateWorkspaceApiKey } = await import("../services/workspaceApiKeys");
    const v = await validateWorkspaceApiKey(apiKey, { ip: req.ip });
    if (v) return db.getUserById(v.userId);
  } catch {
    /* fall through */
  }
  return db.getUserByApiKey(apiKey);
}

function parseBodyContent(body: Record<string, unknown>): unknown | null {
  if (typeof body.postmanContent === "string" && body.postmanContent.trim()) {
    try {
      return JSON.parse(body.postmanContent);
    } catch {
      return null;
    }
  }
  if (typeof body.openapiContent === "string" && body.openapiContent.trim()) {
    try {
      return JSON.parse(body.openapiContent);
    } catch {
      // try as already object-like
      return null;
    }
  }
  if (body.collection && typeof body.collection === "object") return body.collection;
  return null;
}

export function registerGitHubCiScanRoute(app: Express): void {
  app.post("/api/github/scan", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        res.status(401).json({ error: "Invalid or missing API key" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const idempotencyKey =
        (req.headers["x-idempotency-key"] as string) ||
        (typeof body.headSha === "string" && typeof body.repository === "string"
          ? `ghscan:${body.repository}:${body.headSha}`
          : undefined);

      if (idempotencyKey) {
        try {
          const cached = await redis.get(`idem:${idempotencyKey}`);
          if (cached) {
            res.status(200).json(JSON.parse(cached));
            return;
          }
        } catch {
          /* continue */
        }
      }

      let collection = parseBodyContent(body);
      // Minimal empty collection if no content — return clean scan rather than 500
      if (!collection) {
        collection = { item: [], paths: {} };
      }

      const result = runScan(collection);
      const score = calculateRiskScore(result.findings);
      const level = getRiskLevel(score);

      const findings = result.findings.map((f) => ({
        id: crypto.randomUUID(),
        title: f.title,
        severity: f.severity,
        description: f.description,
        category: f.category,
        remediation: f.remediation,
        cweId: f.standards.cwe?.[0] ?? null,
        ruleId: f.ruleId,
        confidence: f.confidence,
        fingerprint: f.fingerprint,
        endpoint: f.endpoint,
        method: f.method,
      }));

      const sarif = {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [
          {
            tool: {
              driver: {
                name: "Rakshex",
                informationUri: "https://rakshex.in",
              },
            },
            results: findings.map((f) => ({
              ruleId: f.ruleId,
              level: f.severity === "Critical" || f.severity === "High" ? "error" : "warning",
              message: { text: f.title },
              properties: { confidence: f.confidence, fingerprint: f.fingerprint },
            })),
          },
        ],
      };

      const payload = {
        success: true,
        repository: body.repository ?? null,
        prNumber: body.prNumber ?? null,
        headSha: body.headSha ?? null,
        riskScore: score,
        riskLevel: level,
        findings,
        costAnomalies: [],
        shadowApis: [],
        sarif,
        rulesRun: result.rulesRun,
        endpointCount: result.endpointCount,
      };

      if (idempotencyKey) {
        try {
          await redis.set(`idem:${idempotencyKey}`, JSON.stringify(payload), "EX", IDEMPOTENCY_TTL);
        } catch {
          /* optional */
        }
      }

      await db.createAuditLogEntry(user.id, "ci_github_scan", {
        repository: body.repository,
        prNumber: body.prNumber,
        findings: findings.length,
      });

      res.status(200).json(payload);
    } catch (err) {
      logger.error({ err }, "[GitHub CI Scan] failed");
      res.status(500).json({ error: "Scan failed" });
    }
  });
}
