/**
 * BullMQ PR Scan Worker — scans API changes in PRs and posts findings as comments.
 */

import { logger } from "../../_core/logger";
import { getInstallationClient } from "../../services/githubApp";
import * as db from "../../db";
import type { Job } from "bullmq";

export interface PrScanJobData {
  installationId: number;
  repoFullName: string;
  prNumber: number;
  headSha: string;
  workspaceId: string;
}

export async function processPrScanJob(job: Job<PrScanJobData>): Promise<void> {
  const { installationId, repoFullName, prNumber, headSha, workspaceId } = job.data;

  logger.info({ installationId, repoFullName, prNumber }, "[prScanWorker] starting PR scan");

  try {
    const octokit = (await getInstallationClient(installationId)) as {
      rest: {
        pulls: {
          listFiles: (
            params: unknown,
          ) => Promise<{ data: Array<{ filename: string; status: string }> }>;
        };
        repos: {
          getContent: (
            params: unknown,
          ) => Promise<{ data: { content?: string; encoding?: string } }>;
        };
        issues: { createComment: (params: unknown) => Promise<void> };
      };
    };

    // 1. Get changed files
    const files = await octokit.rest.pulls.listFiles({
      owner: repoFullName.split("/")[0],
      repo: repoFullName.split("/")[1],
      pull_number: prNumber,
    });

    const apiFiles = files.data.filter(
      (f) => /\.(yaml|yml|json|ts|py)$/.test(f.filename) && f.status !== "removed",
    );

    if (apiFiles.length === 0) {
      logger.info({ prNumber }, "[prScanWorker] no API files changed");
      return;
    }

    let passed = 0;
    let warnings = 0;
    let critical = 0;
    const findings: Array<{
      severity: string;
      finding: string;
      endpoint: string;
      owasp: string;
    }> = [];

    for (const file of apiFiles.slice(0, 10)) {
      try {
        const content = await octokit.rest.repos.getContent({
          owner: repoFullName.split("/")[0],
          repo: repoFullName.split("/")[1],
          path: file.filename,
          ref: headSha,
        });

        const data = content.data as { content?: string; encoding?: string };
        if (data.content && data.encoding === "base64") {
          const text = Buffer.from(data.content, "base64").toString("utf-8");
          // Basic scan: check for credential patterns
          const result = scanContent(file.filename, text);
          findings.push(...result.findings);
          passed += result.passed;
          warnings += result.warnings;
          critical += result.critical;
        }
      } catch (err) {
        logger.warn({ err, file: file.filename }, "[prScanWorker] failed to fetch file");
      }
    }

    // 2. Post PR comment
    const summary = buildComment(findings, passed, warnings, critical);
    await octokit.rest.issues.createComment({
      owner: repoFullName.split("/")[0],
      repo: repoFullName.split("/")[1],
      issue_number: prNumber,
      body: summary,
    });

    logger.info({ prNumber, passed, warnings, critical }, "[prScanWorker] PR scan complete");
  } catch (err) {
    logger.error({ err, prNumber }, "[prScanWorker] PR scan failed");
    throw err;
  }
}

function scanContent(
  filename: string,
  content: string,
): {
  findings: Array<{ severity: string; finding: string; endpoint: string; owasp: string }>;
  passed: number;
  warnings: number;
  critical: number;
} {
  const findings: Array<{ severity: string; finding: string; endpoint: string; owasp: string }> =
    [];
  let passed = 0;
  let warnings = 0;
  let critical = 0;

  const credentialRegexes = [
    { pattern: /(?:api[_-]?key|apikey|API_KEY)\s*[:=]\s*['"]([^'"]{16,})['"]/g, owasp: "API8" },
    { pattern: /(?:password|passwd|secret)\s*[:=]\s*['"]([^'"]{6,})['"]/g, owasp: "API8" },
    { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, owasp: "API8" },
  ];

  for (const { pattern, owasp } of credentialRegexes) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(content)) !== null) {
      findings.push({
        severity: "Critical",
        finding: "Exposed credential detected",
        endpoint: filename,
        owasp,
      });
      critical++;
    }
  }

  if (findings.length === 0) {
    passed = 1;
  }

  return { findings, passed, warnings, critical };
}

function buildComment(
  findings: Array<{ severity: string; finding: string; endpoint: string; owasp: string }>,
  passed: number,
  warnings: number,
  critical: number,
): string {
  const header = `## DevPulse Security Scan\n\n`;
  const summary = `✅ ${passed} passed | ⚠️ ${warnings} warnings | 🔴 ${critical} critical\n\n`;

  if (findings.length === 0) {
    return `${header}${summary}🎉 No security findings in this PR.`;
  }

  const table = `| Severity | Finding | Endpoint | OWASP |\n|---|---|---|---|\n${findings
    .map(
      (f) =>
        `| ${f.severity === "Critical" ? "🔴" : "⚠️"} ${f.severity} | ${f.finding} | ${f.endpoint} | ${f.owasp} |`,
    )
    .join("\n")}`;

  return `${header}${summary}${table}\n\n> Review these findings before merging. [View in DevPulse](https://app.devpulse.in)`;
}
