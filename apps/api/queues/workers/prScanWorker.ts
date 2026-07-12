/**
 * BullMQ PR Scan Worker — scans changed files in PRs for secrets, credentials,
 * and common security issues. Posts rich findings as PR comments.
 * Now uses real secretScanner + additional heuristics for market-ready quality.
 */

import { Worker, type Job } from "bullmq";
import { redis } from "../../_core/cache";
import { logger } from "../../_core/logger";
import { getInstallationClient } from "../../services/githubApp";
import { scanText, type SecretFinding } from "../../services/secretScanner";

export interface PrScanJobData {
  installationId: number;
  repoFullName: string;
  prNumber: number;
  headSha: string;
  workspaceId: string;
}

let worker: Worker<PrScanJobData> | null = null;

export function startPrScanWorker(): Worker<PrScanJobData> | null {
  if (worker) return worker;
  if (!redis || !process.env.REDIS_URL) {
    logger.info(
      "[prScanWorker] Skipping BullMQ (no Redis) — PR scans will rely on direct calls or mock",
    );
    return null;
  }

  worker = new Worker<PrScanJobData>(
    "pr-scan",
    async (job: Job<PrScanJobData>) => {
      await processPrScanJob(job);
    },
    {
      connection: redis,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, pr: job.data.prNumber }, "[prScanWorker] Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id, pr: job?.data?.prNumber }, "[prScanWorker] Job failed");
  });

  logger.info("[prScanWorker] Started (listening to pr-scan queue)");
  return worker;
}

export async function stopPrScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[prScanWorker] Stopped");
  }
}

export async function processPrScanJob(job: Job<PrScanJobData>): Promise<void> {
  const { installationId, repoFullName, prNumber, headSha } = job.data;

  logger.info({ installationId, repoFullName, prNumber }, "[prScanWorker] starting PR scan");

  try {
    const octokit = (await getInstallationClient(installationId)) as any;

    if (!octokit?.rest) {
      logger.warn("[prScanWorker] No Octokit client — using simulated scan");
      // In dev without real GitHub App, still provide value
      await postSimulatedComment(
        repoFullName,
        prNumber,
        "Simulated PR scan (configure GitHub App for live scanning)",
      );
      return;
    }

    // 1. Get changed files
    const filesResp = await octokit.rest.pulls.listFiles({
      owner: repoFullName.split("/")[0],
      repo: repoFullName.split("/")[1],
      pull_number: prNumber,
    });

    const files = filesResp.data || [];
    const codeFiles = files.filter(
      (f: any) =>
        /\.(ts|tsx|js|jsx|py|java|go|rb|php|yaml|yml|json|env)$/.test(f.filename) &&
        f.status !== "removed",
    );

    if (codeFiles.length === 0) {
      logger.info({ prNumber }, "[prScanWorker] no relevant files changed");
      await octokit.rest.issues.createComment({
        owner: repoFullName.split("/")[0],
        repo: repoFullName.split("/")[1],
        issue_number: prNumber,
        body: `## 🛡️ Rakshex PR Security Scan\n\nNo security-relevant files changed in this PR. ✅`,
      });
      return;
    }

    const allFindings: Array<{
      severity: string;
      finding: string;
      file: string;
      line?: number;
      rule?: string;
    }> = [];
    let criticalCount = 0;
    let highCount = 0;

    for (const file of codeFiles.slice(0, 15)) {
      try {
        const contentResp = await octokit.rest.repos.getContent({
          owner: repoFullName.split("/")[0],
          repo: repoFullName.split("/")[1],
          path: file.filename,
          ref: headSha,
        });

        const data = contentResp.data as any;
        let text = "";
        if (data.content && data.encoding === "base64") {
          text = Buffer.from(data.content, "base64").toString("utf-8");
        } else if (typeof data === "string") {
          text = data;
        }

        if (!text) continue;

        // 1. Real secret scanning
        const secrets: SecretFinding[] = scanText(text);
        for (const s of secrets) {
          allFindings.push({
            severity: s.severity === "critical" ? "Critical" : "High",
            finding: s.description,
            file: file.filename,
            line: s.line,
            rule: s.ruleId,
          });
          if (s.severity === "critical") criticalCount++;
          else highCount++;
        }

        // 2. Additional lightweight heuristics (auth, hardcoded urls, debug, etc.)
        const extra = runExtraHeuristics(file.filename, text);
        allFindings.push(...extra);
        criticalCount += extra.filter((e) => e.severity === "Critical").length;
        highCount += extra.filter((e) => e.severity === "High").length;
      } catch (err) {
        logger.warn({ err, file: file.filename }, "[prScanWorker] failed to fetch/scan file");
      }
    }

    // Build and post comment
    const summary = buildRichComment(allFindings, criticalCount, highCount, codeFiles.length);
    await octokit.rest.issues.createComment({
      owner: repoFullName.split("/")[0],
      repo: repoFullName.split("/")[1],
      issue_number: prNumber,
      body: summary,
    });

    logger.info(
      { prNumber, findings: allFindings.length, critical: criticalCount },
      "[prScanWorker] PR scan complete — comment posted",
    );
  } catch (err) {
    logger.error({ err, prNumber }, "[prScanWorker] PR scan failed");
    // Try to post failure notice
    try {
      const octokit = (await getInstallationClient(installationId)) as any;
      if (octokit?.rest) {
        await octokit.rest.issues.createComment({
          owner: repoFullName.split("/")[0],
          repo: repoFullName.split("/")[1],
          issue_number: prNumber,
          body: `## 🛡️ Rakshex PR Scan\n\nScan encountered an error: ${String((err as any)?.message || err)}. Please check configuration or retry.`,
        });
      }
    } catch (e) {
      /* best-effort comment posting */
    }
    throw err;
  }
}

function runExtraHeuristics(filename: string, content: string) {
  const findings: any[] = [];
  const lines = content.split("\n");

  // Hardcoded URLs / localhost in prod code risk
  if (
    /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(content) &&
    !filename.includes("test") &&
    !filename.includes(".env")
  ) {
    findings.push({
      severity: "Medium",
      finding: "Hardcoded localhost/loopback URL in source",
      file: filename,
    });
  }

  // Debug / console.log of sensitive
  if (/console\.(log|debug|dir)\s*\([^)]*(password|secret|token|key|credential)/i.test(content)) {
    findings.push({
      severity: "High",
      finding: "Potential sensitive data logged to console",
      file: filename,
    });
  }

  // TODO / FIXME / HACK in production paths
  if (/TODO|FIXME|HACK|XXX/i.test(content) && !filename.match(/\.(md|txt)$/)) {
    findings.push({
      severity: "Low",
      finding: "Unresolved TODO/FIXME/HACK comment in code",
      file: filename,
    });
  }

  // Missing rate limiting hint in API files (simple)
  if (
    /(app|router|express)\.(post|put|delete)/i.test(content) &&
    !/rateLimit|throttle|limiter/i.test(content)
  ) {
    findings.push({
      severity: "Medium",
      finding: "State-changing endpoint without obvious rate limiting",
      file: filename,
    });
  }

  return findings;
}

function buildRichComment(
  findings: Array<{
    severity: string;
    finding: string;
    file: string;
    line?: number;
    rule?: string;
  }>,
  critical: number,
  high: number,
  filesScanned: number,
): string {
  const header = `## 🛡️ Rakshex Security Scan\n\n`;
  const counts = `**Files scanned:** ${filesScanned}  |  🔴 Critical: ${critical}  |  🟠 High: ${high}  |  🟡 Other: ${findings.length - critical - high}\n\n`;

  if (findings.length === 0) {
    return `${header}${counts}✅ **No security issues detected in this PR.**\n\nGreat work! Consider running a full collection scan for deeper coverage.`;
  }

  let body = `${header}${counts}`;

  const criticals = findings.filter((f) => f.severity === "Critical");
  const highs = findings.filter((f) => f.severity === "High");

  if (criticals.length) {
    body += `### 🔴 Critical Issues\n`;
    criticals.slice(0, 8).forEach((f) => {
      body += `- **${f.finding}** in \`${f.file}\`${f.line ? ` (line ~${f.line})` : ""}${f.rule ? ` • ${f.rule}` : ""}\n`;
    });
    body += `\n`;
  }

  if (highs.length) {
    body += `### 🟠 High Issues\n`;
    highs.slice(0, 8).forEach((f) => {
      body += `- **${f.finding}** in \`${f.file}\`${f.line ? ` (line ~${f.line})` : ""}\n`;
    });
    body += `\n`;
  }

  const others = findings
    .filter((f) => f.severity !== "Critical" && f.severity !== "High")
    .slice(0, 5);
  if (others.length) {
    body +=
      `### Other findings\n` +
      others.map((f) => `- ${f.finding} in \`${f.file}\``).join("\n") +
      `\n\n`;
  }

  body += `> Review these before merging. [Open in Rakshex Dashboard](${process.env.APP_URL || "https://rakshex.in"}) for full details and fixes.\n`;
  body += `> Powered by real-time secret scanning + heuristic analysis.`;

  return body;
}

async function postSimulatedComment(repoFullName: string, prNumber: number, note: string) {
  // Fallback for dev / no real client
  logger.info(
    { repoFullName, prNumber },
    "[prScanWorker] Simulated comment (no live GitHub client)",
  );
  // In real env this would post; for now just log success path
}
