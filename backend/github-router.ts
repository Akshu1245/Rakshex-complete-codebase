import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { eq, and, desc } from "drizzle-orm";
import { findings, scans, collections, users } from "@/db/schema";
import { scanService } from "../services/scanService";
import { unifiedRiskScore } from "../services/unifiedRiskScore";
import { collectionCredentialScan } from "../services/collectionCredentialScan";
import { shadowAPIService } from "../services/shadowAPIService";

// GitHub webhook payload schema
const githubWebhookSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    head: z.object({
      sha: z.string(),
      ref: z.string(),
      repo: z.object({
        full_name: z.string(),
        clone_url: z.string(),
      }),
    }),
    base: z.object({
      sha: z.string(),
      ref: z.string(),
    }),
    user: z.object({
      login: z.string(),
      id: z.number(),
    }),
    changed_files: z.number().optional(),
  }),
  repository: z.object({
    id: z.number(),
    full_name: z.string(),
    private: z.boolean(),
    default_branch: z.string(),
  }),
});

// PR scan request schema
const prScanRequestSchema = z.object({
  repository: z.string(),
  prNumber: z.number(),
  headSha: z.string(),
  baseSha: z.string(),
  framework: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
  openapiPath: z.string().optional(),
  postmanPath: z.string().optional(),
});

export const githubRouter = router({
  // Webhook endpoint — called by GitHub when PR events occur
  webhook: publicProcedure.input(githubWebhookSchema).mutation(async ({ ctx, input }) => {
    const { action, pull_request, repository } = input;

    // Only scan on PR open or synchronize (new commits pushed)
    if (!["opened", "synchronize", "reopened"].includes(action)) {
      return { status: "ignored", reason: `Action ${action} does not trigger scan` };
    }

    // Find the Rakshex user/org that owns this repo
    const org = await ctx.db.query.organizations.findFirst({
      where: eq(organizations.githubRepo, repository.full_name),
    });

    if (!org) {
      return { status: "ignored", reason: "Repository not linked to Rakshex" };
    }

    // Trigger async scan
    const scanId = await scanService.triggerPRScan({
      orgId: org.id,
      repository: repository.full_name,
      prNumber: pull_request.number,
      headSha: pull_request.head.sha,
      baseSha: pull_request.base.sha,
      branch: pull_request.head.ref,
      cloneUrl: pull_request.head.repo.clone_url,
    });

    return { status: "scanning", scanId };
  }),

  // Direct scan endpoint — called by GitHub Action
  scan: protectedProcedure.input(prScanRequestSchema).mutation(async ({ ctx, input }) => {
    const startTime = Date.now();
    const userId = ctx.session.user.id;

    // 1. Clone or fetch the repo
    const repoPath = await scanService.cloneRepository({
      repository: input.repository,
      sha: input.headSha,
    });

    // 2. Detect framework if not provided
    const framework = input.framework || (await scanService.detectFramework(repoPath));

    // 3. Extract routes from source code
    const discoveredRoutes = await shadowAPIService.extractRoutes(repoPath, framework);

    // 4. Run security scans
    const securityFindings = await scanService.scanRepository({
      path: repoPath,
      framework,
      changedFiles: input.changedFiles || [],
    });

    // 5. Check for OpenAPI/Postman specs
    let specFindings: any[] = [];
    if (input.openapiPath) {
      specFindings = await scanService.scanOpenAPISpec(`${repoPath}/${input.openapiPath}`);
    }
    if (input.postmanPath) {
      const collection = await scanService.readPostmanCollection(
        `${repoPath}/${input.postmanPath}`,
      );
      specFindings = [...specFindings, ...collectionCredentialScan.scan(collection)];
    }

    // 6. Calculate unified risk scores
    const allFindings = [...securityFindings, ...specFindings];
    const scoredFindings = allFindings.map((f) => ({
      ...f,
      unifiedScore: unifiedRiskScore.calculate({
        securitySeverity: f.severity,
        costAnomaly: f.costImpact || 0,
      }),
    }));

    // 7. Sort by unified score (highest first)
    scoredFindings.sort((a, b) => (b.unifiedScore || 0) - (a.unifiedScore || 0));

    // 8. Store scan results
    const scanRecord = await ctx.db
      .insert(scans)
      .values({
        userId,
        repository: input.repository,
        prNumber: input.prNumber,
        headSha: input.headSha,
        framework,
        findingsCount: scoredFindings.length,
        criticalCount: scoredFindings.filter((f) => f.severity === "Critical").length,
        highCount: scoredFindings.filter((f) => f.severity === "High").length,
        riskScore: unifiedRiskScore.aggregate(scoredFindings),
        scanTime: Date.now() - startTime,
        status: "completed",
      })
      .returning();

    // 9. Store individual findings
    if (scoredFindings.length > 0) {
      await ctx.db.insert(findings).values(
        scoredFindings.map((f) => ({
          scanId: scanRecord[0].id,
          userId,
          title: f.title,
          severity: f.severity,
          category: f.category,
          endpoint: f.endpoint,
          remediation: f.remediation,
          unifiedScore: f.unifiedScore,
          status: "open",
        })),
      );
    }

    // 10. Check cost anomalies (if LLM proxy data available)
    const costAnomalies = await scanService.detectCostAnomalies({
      repository: input.repository,
      timeWindow: "6h",
    });

    // 11. Check shadow APIs
    const shadowApis = await shadowAPIService.compareWithInventory({
      orgId: ctx.session.user.organizationId,
      discoveredRoutes,
    });

    // 12. Calculate compliance scores
    const complianceScore = {
      owasp: Math.max(
        0,
        100 -
          (scoredFindings.filter((f) => f.severity === "Critical").length * 15 +
            scoredFindings.filter((f) => f.severity === "High").length * 8),
      ),
      pci: Math.max(
        0,
        100 -
          (scoredFindings.filter((f) => f.severity === "Critical").length * 20 +
            scoredFindings.filter((f) => f.severity === "High").length * 10),
      ),
    };

    // 13. Return formatted response for GitHub Action
    return {
      scanId: scanRecord[0].id,
      findings: scoredFindings.slice(0, 20), // Top 20 for PR comment
      costAnomalies: costAnomalies.slice(0, 5),
      shadowApis: shadowApis.slice(0, 5),
      complianceScore,
      summary: {
        total: scoredFindings.length,
        critical: scoredFindings.filter((f) => f.severity === "Critical").length,
        high: scoredFindings.filter((f) => f.severity === "High").length,
        medium: scoredFindings.filter((f) => f.severity === "Medium").length,
        low: scoredFindings.filter((f) => f.severity === "Low").length,
      },
      scanTime: Date.now() - startTime,
    };
  }),

  // Get scan results for a specific PR
  getPRScan: protectedProcedure
    .input(
      z.object({
        repository: z.string(),
        prNumber: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const scan = await ctx.db.query.scans.findFirst({
        where: and(eq(scans.repository, input.repository), eq(scans.prNumber, input.prNumber)),
        orderBy: desc(scans.createdAt),
        with: {
          findings: true,
        },
      });

      if (!scan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No scan found for this PR",
        });
      }

      return scan;
    }),
});
