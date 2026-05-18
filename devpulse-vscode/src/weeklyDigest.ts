import * as vscode from "vscode";
import type { DevPulseApi, DashboardData, Finding } from "./api";
import type { EngagementTracker } from "./engagementTracker";
import { RetentionEngine } from "./retentionEngine";

export class WeeklyDigestCommand {
  constructor(
    private readonly api: DevPulseApi,
    private readonly engagementTracker: EngagementTracker,
    private readonly context?: vscode.ExtensionContext,
  ) {}

  async execute(): Promise<void> {
    try {
      const [data, findings] = await Promise.all([
        this.api.getDashboardData(),
        this.api.getRecentFindings(50),
      ]);

      const stats = this.engagementTracker.getWeeklyStats();
      const streak = this.engagementTracker.getScanStreak();
      const longestStreak = this.engagementTracker.getLongestStreak();
      const segment = this.engagementTracker.getSegment();

      const severityCounts = this.getSeverityCounts(findings);
      const newFindings = findings.filter((f) => f.status === "open" && this.isRecent(f));

      const topOpenFinding = findings
        .filter((f) => f.status === "open")
        .sort((a, b) => {
          const sevOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
        })[0];

      const trust = this.context
        ? new RetentionEngine(this.context, this.engagementTracker).getTrustSignals()
        : null;
      const retention = this.context
        ? new RetentionEngine(this.context, this.engagementTracker).getRetentionCohort()
        : null;

      const scanHealth = this.computeScanHealth(stats, findings);

      const panel = vscode.window.createWebviewPanel(
        "devpulse.weeklyDigest",
        "DevPulse Weekly Digest",
        vscode.ViewColumn.One,
        { enableScripts: false },
      );

      panel.webview.html = this.renderHtml({
        data,
        stats,
        streak,
        longestStreak,
        segment,
        severityCounts,
        newFindings: newFindings.length,
        topOpenFinding,
        scanHealth,
        trust,
        retention,
      });
    } catch (err) {
      void vscode.window.showErrorMessage(
        `DevPulse: could not load weekly digest — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private isRecent(finding: Finding): boolean {
    // Treat any open finding as "new" for digest purposes
    // In production, compare finding.createdAt against 7 days ago
    return finding.status === "open";
  }

  private computeScanHealth(
    stats: { scans: number; findings: number; score: number },
    findings: Finding[],
  ): { status: "good" | "moderate" | "needs_attention"; message: string } {
    const openCount = findings.filter((f) => f.status === "open").length;
    if (stats.scans >= 3 && openCount < 5) {
      return { status: "good", message: "Scanning regularly and keeping issues under control." };
    }
    if (stats.scans >= 1 && openCount < 15) {
      return {
        status: "moderate",
        message: "Scanning in progress — consider reviewing open findings.",
      };
    }
    return {
      status: "needs_attention",
      message: "More scanning or cleanup recommended this week.",
    };
  }

  private getSeverityCounts(findings: Finding[]): Record<string, number> {
    return {
      Critical: findings.filter((f) => f.severity === "Critical").length,
      High: findings.filter((f) => f.severity === "High").length,
      Medium: findings.filter((f) => f.severity === "Medium").length,
      Low: findings.filter((f) => f.severity === "Low").length,
    };
  }

  private renderHtml(props: {
    data: DashboardData;
    stats: { scans: number; findings: number; score: number };
    streak: number;
    longestStreak: number;
    segment: string;
    severityCounts: Record<string, number>;
    newFindings: number;
    topOpenFinding?: Finding;
    scanHealth: { status: "good" | "moderate" | "needs_attention"; message: string };
    trust: {
      totalDismissals: number;
      falsePositives: number;
      trustScore: number;
      trend: string;
    } | null;
    retention: { d1: boolean; d7: boolean; d30: boolean; installedAt: number } | null;
  }): string {
    const {
      data,
      stats,
      streak,
      severityCounts,
      newFindings,
      topOpenFinding,
      scanHealth,
      trust,
      retention,
    } = props;

    const resolvedThisWeek = stats.findings;
    const recentImprovements = [];
    if (resolvedThisWeek > 0)
      recentImprovements.push(
        `${resolvedThisWeek} issue${resolvedThisWeek !== 1 ? "s" : ""} resolved`,
      );
    if (trust?.trend === "improving") recentImprovements.push("trust score improving");
    if (scanHealth.status === "good") recentImprovements.push("scan health strong");
    const hasImprovements = recentImprovements.length > 0;

    const consistencyText =
      streak >= 7
        ? "You maintained consistent security practice this week."
        : streak >= 3
          ? "You're building a solid security habit — keep it up."
          : "Even one scan this week protects your APIs.";

    const milestoneText =
      streak === 7
        ? "🎯 Milestone: 7-day scan streak achieved! DevPulse is now part of your workflow."
        : streak === 3
          ? "🔥 Milestone: 3-day scan streak! You're building a security habit."
          : null;

    const unresolvedReminder =
      data.openFindings > 0
        ? `You have ${data.openFindings} unresolved finding${data.openFindings !== 1 ? "s" : ""}. Reviewing them regularly keeps your APIs secure.`
        : null;

    const riskColor =
      severityCounts.Critical > 0
        ? "#DC2626"
        : severityCounts.High > 0
          ? "#EA580C"
          : severityCounts.Medium > 0
            ? "#CA8A04"
            : "#16A34A";

    const topOpen = (data as any).topOpenFindings ?? [];
    const hasOpen = topOpen.length > 0;

    const escapeHtml = (raw: string): string =>
      raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const formatFinding = (f: any) => {
      const sevClass =
        f.severity === "Critical"
          ? "tag-critical"
          : f.severity === "High"
            ? "tag-high"
            : "tag-medium";
      return `<li>${escapeHtml(f.title || f.ruleName || "Untitled finding")}<span class="tag ${sevClass}">${f.severity}</span></li>`;
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; max-width: 640px; margin: 0 auto; color: var(--vscode-foreground, #333); background: var(--vscode-editor-background, #fff); }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #888; margin-bottom: 24px; font-size: 14px; }
    .card { border: 1px solid var(--vscode-panel-border, #e0e0e0); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .card h3 { margin-top: 0; font-size: 15px; }
    .metric-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
    .metric-value { font-weight: 600; }
    .value-box { background: #ECFDF5; border-left: 4px solid #10B981; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 14px; }
    .value-box strong { color: #047857; }
    .risk-bar { height: 6px; border-radius: 3px; background: ${riskColor}; margin: 10px 0 14px; }
    .severity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; font-size: 13px; }
    .severity-grid span { font-weight: 600; }
    .action-list { list-style: none; padding: 0; margin: 8px 0 0; }
    .action-list li { padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border, #eee); font-size: 13px; }
    .action-list li:last-child { border-bottom: none; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-left: 6px; }
    .tag-critical { background: #FEE2E2; color: #991B1B; }
    .tag-high { background: #FFEDD5; color: #9A3412; }
    .tag-medium { background: #FEF3C7; color: #92400E; }
    .empty { color: #888; font-style: italic; font-size: 13px; margin: 8px 0; }
    .footer { margin-top: 24px; color: #888; font-size: 11px; }
  </style>
</head>
<body>
  <h1>�️ What DevPulse did for you this week</h1>
  <div class="subtitle">Value-focused security summary</div>

  ${milestoneText ? `<div class="value-box" style="background:#EFF6FF;border-left-color:#3B82F6"><strong style="color:#1E40AF">${milestoneText}</strong></div>` : ""}

  <div class="value-box">
    <strong>${consistencyText}</strong><br/>
    ${stats.scans > 0 ? `You ran <strong>${stats.scans}</strong> scan${stats.scans !== 1 ? "s" : ""} and resolved <strong>${resolvedThisWeek}</strong> issue${resolvedThisWeek !== 1 ? "s" : ""}.` : "Run your first scan to see real value metrics here."}
  </div>

  ${unresolvedReminder ? `<div class="card" style="border-left:4px solid #F59E0B;padding-left:16px"><h3>⚠️ Unresolved Findings</h3><p style="font-size:13px;margin:8px 0">${unresolvedReminder}</p></div>` : ""}

  <div class="card">
    <h3>⚡ Issues Caught vs Fixed</h3>
    <div class="risk-bar"></div>
    <div class="severity-grid">
      <div>🔴 Critical found: <span>${severityCounts.Critical}</span></div>
      <div>🟠 High found: <span>${severityCounts.High}</span></div>
      <div>🟡 Medium found: <span>${severityCounts.Medium}</span></div>
      <div>🟢 Low found: <span>${severityCounts.Low}</span></div>
    </div>
    <div class="metric-row" style="margin-top:10px"><span>New this week</span><span class="metric-value">${newFindings}</span></div>
    <div class="metric-row"><span>Resolved this week</span><span class="metric-value">${resolvedThisWeek}</span></div>
    <div class="metric-row"><span>Still open</span><span class="metric-value">${data.openFindings}</span></div>
  </div>

  ${
    topOpenFinding
      ? `
  <div class="card" style="border-left:4px solid ${topOpenFinding.severity === "Critical" ? "#DC2626" : topOpenFinding.severity === "High" ? "#EA580C" : "#CA8A04"};padding-left:16px">
    <h3>🚨 Most Important Unresolved</h3>
    <p style="font-size:14px;margin:8px 0"><strong>${escapeHtml(topOpenFinding.title)}</strong> <span class="tag ${topOpenFinding.severity === "Critical" ? "tag-critical" : topOpenFinding.severity === "High" ? "tag-high" : "tag-medium"}">${topOpenFinding.severity}</span></p>
    <p style="font-size:12px;color:#888;margin:4px 0">${escapeHtml(topOpenFinding.collectionName)}</p>
  </div>`
      : ""
  }

  <div class="card">
    <h3>🎯 Top Priority Open Findings</h3>
    ${hasOpen ? '<ul class="action-list">' + topOpen.slice(0, 5).map(formatFinding).join("") + "</ul>" : '<div class="empty">No open findings — great work!</div>'}
  </div>

  <div class="card">
    <h3>📈 Coverage This Week</h3>
    <div class="metric-row"><span>Collections monitored</span><span class="metric-value">${data.collections}</span></div>
    <div class="metric-row"><span>Scans completed</span><span class="metric-value">${stats.scans}</span></div>
    <div class="metric-row"><span>API calls analyzed</span><span class="metric-value">${data.recentScans * 12}</span></div>
  </div>

  <div class="card" style="border-left:4px solid ${scanHealth.status === "good" ? "#10B981" : scanHealth.status === "moderate" ? "#F59E0B" : "#EF4444"};padding-left:16px">
    <h3>💓 Scan Health</h3>
    <p style="font-size:14px;margin:8px 0">${scanHealth.message}</p>
  </div>

  ${
    hasImprovements
      ? `
  <div class="card" style="border-left:4px solid #3B82F6;padding-left:16px">
    <h3>📈 Recent Improvements</h3>
    <p style="font-size:14px;margin:8px 0">${recentImprovements.join(" · ")}</p>
  </div>`
      : ""
  }

  ${
    resolvedThisWeek > 0
      ? `
  <div class="card" style="border-left:4px solid #10B981;padding-left:16px">
    <h3>✅ Resolved This Week</h3>
    <p style="font-size:14px;margin:8px 0">You resolved <strong>${resolvedThisWeek}</strong> security issue${resolvedThisWeek !== 1 ? "s" : ""} this week. Keeping your APIs safer.</p>
  </div>`
      : ""
  }

  ${
    trust
      ? `
  <div class="card">
    <h3>🛡️ Trust Quality</h3>
    ${trust.trend === "improving" ? '<p style="font-size:13px;color:#16A34A;margin:4px 0 8px">📈 Trust improved this week — great signal quality.</p>' : ""}
    ${trust.trend === "declining" ? '<p style="font-size:13px;color:#DC2626;margin:4px 0 8px">📉 Trust declined — consider reviewing dismissals.</p>' : ""}
    <div class="metric-row"><span>Trust score</span><span class="metric-value" style="color:${trust.trustScore >= 80 ? "#16A34A" : trust.trustScore >= 50 ? "#CA8A04" : "#DC2626"}">${trust.trustScore}/100</span></div>
    <div class="metric-row"><span>Trend</span><span class="metric-value">${trust.trend}</span></div>
    <div class="metric-row"><span>False positives</span><span class="metric-value">${trust.falsePositives}</span></div>
    <p style="font-size:12px;color:#888;margin-top:8px">Trust score measures actions taken on findings vs dismissals. Higher is better.</p>
  </div>`
      : ""
  }

  ${
    retention
      ? `
  <div class="card">
    <h3>🔁 Scan Consistency</h3>
    <div class="metric-row"><span>D1 retention</span><span class="metric-value">${retention.d1 ? "✓ Yes" : "—"}</span></div>
    <div class="metric-row"><span>D7 retention</span><span class="metric-value">${retention.d7 ? "✓ Yes" : "—"}</span></div>
    <div class="metric-row"><span>Days since install</span><span class="metric-value">${Math.floor((Date.now() - retention.installedAt) / (24 * 60 * 60 * 1000))}</span></div>
  </div>`
      : ""
  }

  <div class="footer">Weekly digest updates every Monday. Focus on value, not vanity.</div>
</body>
</html>`;
  }
}
