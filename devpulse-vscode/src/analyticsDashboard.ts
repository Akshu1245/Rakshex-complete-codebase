import * as vscode from "vscode";
import type { EngagementTracker } from "./engagementTracker";
import { RetentionEngine } from "./retentionEngine";

export class AnalyticsDashboard {
  private panel?: vscode.WebviewPanel;
  private readonly retention: RetentionEngine;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly engagementTracker: EngagementTracker,
  ) {
    this.retention = new RetentionEngine(context, engagementTracker);
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "rakshex.analytics",
      "Rakshex Analytics",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.html = this.getHtml(this.computeMetrics());
  }

  private computeMetrics(): FunnelMetrics {
    const progress = this.engagementTracker.getOnboardingProgress();
    const score = this.engagementTracker.getScore();
    const retention = this.retention.getRetentionCohort();
    const funnel = this.retention.getActivationFunnel();
    const trust = this.retention.getTrustSignals();
    const pmf = this.retention.getPmfSignal();
    const value = this.retention.getValueMetrics();

    const installed = true;
    const tourStarted =
      progress.some((p) => p.step === "tour_started") ||
      this.context.globalState.get<boolean>("rakshex.tourDismissed") === false;
    const signedIn = progress.some((p) => p.step === "signed_in" && p.complete);
    const imported = progress.some((p) => p.step === "imported" && p.complete);
    const firstScan = progress.some((p) => p.step === "scanned" && p.complete);
    const foundIssue = progress.some((p) => p.step === "found_issue" && p.complete);

    const installDate = this.context.globalState.get<number>("rakshex.installDate") ?? Date.now();
    const daysSinceInstall = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));

    return {
      stages: [
        { name: "Extension Installed", complete: installed, icon: "📦" },
        { name: "Tour Started", complete: tourStarted, icon: "🎯" },
        { name: "Signed In", complete: signedIn, icon: "🔑" },
        { name: "Collection Imported", complete: imported, icon: "📥" },
        { name: "First Scan", complete: firstScan, icon: "🔍" },
        { name: "Found Issue", complete: foundIssue, icon: "🛡️" },
      ],
      conversionRate: signedIn ? Math.round((firstScan ? 1 : 0) * 100) : 0,
      daysSinceInstall,
      engagementScore: score,
      activated: signedIn && firstScan,
      dropOffStage: this.getDropOffStage(progress),
      retention,
      funnel,
      trust,
      pmf,
      value,
    };
  }

  private getDropOffStage(progress: Array<{ step: string; complete: boolean }>): string | null {
    const order = ["signed_in", "imported", "scanned", "found_issue"];
    for (const step of order) {
      const found = progress.find((p) => p.step === step);
      if (!found || !found.complete) return step;
    }
    return null;
  }

  private getHtml(metrics: FunnelMetrics): string {
    const nonce = Math.random().toString(36).slice(2);

    const totalStages = metrics.stages.length;
    const completedStages = metrics.stages.filter((s) => s.complete).length;
    const progressPct = Math.round((completedStages / totalStages) * 100);

    const stageRows = metrics.stages
      .map((s) => {
        const status = s.complete
          ? `<span style="color:#22c55e;font-weight:600">✓</span>`
          : `<span style="color:#f59e0b;font-weight:600">○</span>`;
        const bg = s.complete ? "rgba(34,197,94,0.06)" : "transparent";
        return `
          <tr style="background:${bg}">
            <td style="padding:8px 6px;font-size:16px">${s.icon}</td>
            <td style="padding:8px 6px;font-weight:500;font-size:13px">${s.name}</td>
            <td style="padding:8px 6px;text-align:right">${status}</td>
          </tr>`;
      })
      .join("");

    const retentionBadge = (ok: boolean) =>
      ok
        ? `<span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">Retained</span>`
        : `<span style="background:rgba(148,163,184,0.12);color:#94a3b8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">—</span>`;

    const pmfColor =
      metrics.pmf.verdict === "strong_pmf"
        ? "#22c55e"
        : metrics.pmf.verdict === "promising"
          ? "#3b82f6"
          : metrics.pmf.verdict === "needs_work"
            ? "#f59e0b"
            : "#ef4444";

    const trustColor =
      metrics.trust.trustScore >= 80
        ? "#22c55e"
        : metrics.trust.trustScore >= 50
          ? "#f59e0b"
          : "#ef4444";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
    .metric-card { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .metric-box { flex: 1; min-width: 100px; padding: 12px; background: var(--vscode-panel-background, #1e1e1e); border-radius: 8px; text-align: center; border: 1px solid var(--vscode-panel-border, #333); }
    .metric-value { font-size: 22px; font-weight: 700; color: #2563EB; margin-bottom: 2px; }
    .metric-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .progress-bar { height: 6px; background: var(--vscode-panel-border, #333); border-radius: 3px; margin: 6px 0 16px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #2563EB, #22c55e); border-radius: 3px; transition: width 0.4s ease; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    td { border-bottom: 1px solid var(--vscode-panel-border, #333); }
    .section { margin-bottom: 20px; padding: 14px; background: var(--vscode-panel-background, #1e1e1e); border-radius: 8px; border: 1px solid var(--vscode-panel-border, #333); }
    .section h3 { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--vscode-foreground); }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
    .row:not(:last-child) { border-bottom: 1px solid var(--vscode-panel-border, #333); }
    .score-pill { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; }
    .tip { margin-top: 16px; padding: 12px; background: rgba(37,99,235,0.06); border-radius: 8px; font-size: 12px; color: #888; border: 1px solid rgba(37,99,235,0.15); }
  </style>
</head>
<body>
  <h2>Rakshex Analytics</h2>
  <div class="subtitle">Product signals: retention, trust, PMF, and value</div>

  <div class="metric-card">
    <div class="metric-box">
      <div class="metric-value">${progressPct}%</div>
      <div class="metric-label">Onboarding</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${metrics.pmf.score}</div>
      <div class="metric-label">PMF Score</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${metrics.trust.trustScore}</div>
      <div class="metric-label">Trust Score</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${metrics.daysSinceInstall}</div>
      <div class="metric-label">Days Since Install</div>
    </div>
  </div>

  <div style="margin-bottom:6px;font-size:12px;color:#888;font-weight:500">Onboarding Progress</div>
  <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
  <table><tbody>${stageRows}</tbody></table>

  <div class="section">
    <h3>📊 Retention Cohort</h3>
    <div class="row"><span>D1 (day after install)</span>${retentionBadge(metrics.retention.d1)}</div>
    <div class="row"><span>D7 (week after install)</span>${retentionBadge(metrics.retention.d7)}</div>
    <div class="row"><span>D30 (month after install)</span>${retentionBadge(metrics.retention.d30)}</div>
    <div class="row"><span>Scans this week</span><strong>${metrics.pmf.scansPerWeek}</strong></div>
    <div class="row"><span>Time to first scan</span><strong>${metrics.funnel.timeToFirstScanDays !== null ? metrics.funnel.timeToFirstScanDays + " days" : "—"}</strong></div>
  </div>

  <div class="section">
    <h3>🛡️ Trust Signals</h3>
    <div class="row"><span>Trust score</span><span class="score-pill" style="background:${trustColor}20;color:${trustColor}">${metrics.trust.trustScore}/100</span></div>
    <div class="row"><span>Trend</span><strong>${metrics.trust.trend}</strong></div>
    <div class="row"><span>Total dismissals</span><strong>${metrics.trust.totalDismissals}</strong></div>
    <div class="row"><span>False positives</span><strong>${metrics.trust.falsePositives}</strong></div>
  </div>

  <div class="section">
    <h3>🎯 PMF Signal</h3>
    <div class="row"><span>Verdict</span><span class="score-pill" style="background:${pmfColor}20;color:${pmfColor}">${metrics.pmf.verdict.replace(/_/g, " ")}</span></div>
    <div class="row"><span>Activated</span><strong>${metrics.pmf.activated ? "Yes" : "No"}</strong></div>
    <div class="row"><span>Second scan completed</span><strong>${metrics.funnel.secondScan ? "Yes" : "No"}</strong></div>
    <div class="row"><span>Findings acted on</span><strong>${metrics.pmf.findingsActedOn}</strong></div>
  </div>

  <div class="section">
    <h3>💎 Value Delivered</h3>
    <div class="row"><span>Total scans run</span><strong>${metrics.value.scansTotal}</strong></div>
    <div class="row"><span>Findings discovered</span><strong>${metrics.value.findingsDiscovered}</strong></div>
    <div class="row"><span>Findings resolved</span><strong>${metrics.value.findingsResolved}</strong></div>
    <div class="row"><span>Estimated secrets found</span><strong>${metrics.value.secretsFound}</strong></div>
    <div class="row"><span>Issues prevented (est.)</span><strong>${metrics.value.estimatedIssuesPrevented}</strong></div>
  </div>

  <div class="tip">
    <strong>Activation =</strong> Signed in + completed first scan. Users who reach this point are 3–5x more likely to retain.
    <br><br>
    <strong>Trust Score</strong> measures actions taken on findings vs dismissals. Higher is better.
    <br><br>
    <strong>PMF Score</strong> combines activation depth, scan frequency, and finding engagement.
  </div>
</body>
</html>`;
  }
}

interface FunnelMetrics {
  stages: Array<{ name: string; complete: boolean; icon: string }>;
  conversionRate: number;
  daysSinceInstall: number;
  engagementScore: number;
  activated: boolean;
  dropOffStage: string | null;
  retention: { d1: boolean; d7: boolean; d30: boolean; installedAt: number };
  funnel: {
    installed: boolean;
    signedIn: boolean;
    firstScan: boolean;
    secondScan: boolean;
    activated: boolean;
    timeToFirstScanDays: number | null;
  };
  trust: { totalDismissals: number; falsePositives: number; trustScore: number; trend: string };
  pmf: {
    activated: boolean;
    scansPerWeek: number;
    findingsActedOn: number;
    score: number;
    verdict: string;
  };
  value: {
    scansTotal: number;
    findingsDiscovered: number;
    findingsResolved: number;
    secretsFound: number;
    estimatedIssuesPrevented: number;
  };
}
