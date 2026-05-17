import * as vscode from "vscode";
import type { EngagementTracker } from "./engagementTracker";

export class AnalyticsDashboard {
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly engagementTracker: EngagementTracker,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "devpulse.analytics",
      "DevPulse Analytics",
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

    const installed = true; // extension is running
    const tourStarted =
      progress.some((p) => p.step === "tour_started") ||
      this.context.globalState.get<boolean>("devpulse.tourDismissed") === false;
    const signedIn = progress.some((p) => p.step === "signed_in" && p.complete);
    const imported = progress.some((p) => p.step === "imported" && p.complete);
    const firstScan = progress.some((p) => p.step === "scanned" && p.complete);
    const foundIssue = progress.some((p) => p.step === "found_issue" && p.complete);

    const installDate = this.context.globalState.get<number>("devpulse.installDate") ?? Date.now();
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
      .map((s, i) => {
        const status = s.complete
          ? `<span style="color:#22c55e;font-weight:600">✓ Complete</span>`
          : `<span style="color:#f59e0b;font-weight:600">○ Pending</span>`;
        const bg = s.complete ? "rgba(34,197,94,0.06)" : "transparent";
        return `
          <tr style="background:${bg}">
            <td style="padding:10px 8px;font-size:18px">${s.icon}</td>
            <td style="padding:10px 8px;font-weight:500">${s.name}</td>
            <td style="padding:10px 8px;text-align:right">${status}</td>
          </tr>`;
      })
      .join("");

    const activationStatus = metrics.activated
      ? `<div style="color:#22c55e;font-weight:700;font-size:14px">✓ User Activated</div>`
      : `<div style="color:#f59e0b;font-weight:700;font-size:14px">○ Not Yet Activated</div>`;

    const dropOffHtml = metrics.dropOffStage
      ? `<div style="margin-top:16px;padding:12px;background:rgba(245,158,11,0.08);border-radius:8px;border:1px solid rgba(245,158,11,0.2)">
          <div style="font-weight:600;color:#f59e0b;margin-bottom:4px">⚠ Drop-off Detected</div>
          <div style="font-size:12px;color:#888">Users are getting stuck at: <strong>${metrics.dropOffStage}</strong></div>
        </div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      max-width: 560px;
      margin: 0 auto;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 { margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
    .metric-card {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-box {
      flex: 1;
      padding: 14px;
      background: var(--vscode-panel-background, #1e1e1e);
      border-radius: 10px;
      text-align: center;
      border: 1px solid var(--vscode-panel-border, #333);
    }
    .metric-value {
      font-size: 26px;
      font-weight: 700;
      color: #2563EB;
      margin-bottom: 2px;
    }
    .metric-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .progress-bar {
      height: 6px;
      background: var(--vscode-panel-border, #333);
      border-radius: 3px;
      margin: 8px 0 20px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563EB, #22c55e);
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    table { width: 100%; border-collapse: collapse; }
    td { border-bottom: 1px solid var(--vscode-panel-border, #333); font-size: 13px; }
    .tip {
      margin-top: 20px;
      padding: 12px;
      background: rgba(37,99,235,0.06);
      border-radius: 8px;
      font-size: 12px;
      color: #888;
      border: 1px solid rgba(37,99,235,0.15);
    }
  </style>
</head>
<body>
  <h2>DevPulse Analytics</h2>
  <div class="subtitle">Onboarding funnel and activation metrics for this workspace</div>

  <div class="metric-card">
    <div class="metric-box">
      <div class="metric-value">${progressPct}%</div>
      <div class="metric-label">Onboarding</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${metrics.engagementScore}</div>
      <div class="metric-label">Engagement Score</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${metrics.daysSinceInstall}</div>
      <div class="metric-label">Days Since Install</div>
    </div>
  </div>

  <div style="margin-bottom:6px;font-size:12px;color:#888;font-weight:500">Onboarding Progress</div>
  <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>

  <table>
    <tbody>${stageRows}</tbody>
  </table>

  <div style="margin-top:16px;text-align:center">${activationStatus}</div>

  ${dropOffHtml}

  <div class="tip">
    <strong>What's tracked:</strong> Install, tour start, API key sign-in, collection import, first scan, and first finding.
    <br><br>
    <strong>Activation =</strong> Signed in <em>and</em> completed first scan. Users who reach this point are 3–5x more likely to retain.
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
}
