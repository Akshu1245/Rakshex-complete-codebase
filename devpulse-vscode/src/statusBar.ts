import * as vscode from "vscode";
import type { DevPulseApi, DashboardData, Finding, Severity } from "./api";

/**
 * Status bar item showing DevPulse health at a glance.
 *   - not signed in  : "$(shield) DevPulse: Sign in"
 *   - signed in ok   : "$(shield) DevPulse: 2C 5H 3M"
 *   - error          : "$(alert) DevPulse: Error"
 *
 * Color changes based on risk level:
 *   - Green: no critical/high findings
 *   - Yellow: high findings present
 *   - Red: critical findings present
 */
export class DevPulseStatusBar {
  private readonly item: vscode.StatusBarItem;
  private findings: Finding[] = [];

  constructor(private readonly api: DevPulseApi) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.name = "DevPulse";
    this.item.command = "devpulse.openSecurityPanel";
  }

  dispose(): void {
    this.item.dispose();
  }

  showSignedOut(): void {
    this.item.text = "$(shield) DevPulse: Sign in";
    this.item.tooltip = "Click or run 'DevPulse: Sign in with API Key'";
    this.item.command = "devpulse.authenticate";
    this.item.color = undefined;
    this.item.backgroundColor = undefined;
    this.item.show();
  }

  showError(message: string): void {
    this.item.text = "$(alert) DevPulse";
    this.item.tooltip = `DevPulse error: ${message}`;
    this.item.command = "devpulse.refresh";
    this.item.color = new vscode.ThemeColor("errorForeground");
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    this.item.show();
  }

  showSummary(data: DashboardData, findings: Finding[]): void {
    this.findings = findings;

    const severityCounts = this.getSeverityCounts(findings);
    const hasCritical = severityCounts.Critical > 0;
    const hasHigh = severityCounts.High > 0;

    // Build the compact display: "2C 5H 3M 1L"
    const parts: string[] = [];
    if (severityCounts.Critical > 0) parts.push(`${severityCounts.Critical}C`);
    if (severityCounts.High > 0) parts.push(`${severityCounts.High}H`);
    if (severityCounts.Medium > 0) parts.push(`${severityCounts.Medium}M`);
    if (severityCounts.Low > 0) parts.push(`${severityCounts.Low}L`);

    const findingsText = parts.length > 0 ? parts.join(" ") : "✓ clear";
    const cost = data.weeklyCost;

    this.item.text = `$(shield) DevPulse: ${findingsText} · $${cost.toFixed(2)}/wk`;

    // Color based on risk level
    if (hasCritical) {
      this.item.color = new vscode.ThemeColor("statusBarItem.errorForeground");
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (hasHigh) {
      this.item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
      this.item.color = undefined;
      this.item.backgroundColor = undefined;
    }

    // Detailed tooltip
    this.item.tooltip = [
      `DevPulse Security Status`,
      ``,
      `Collections: ${data.collections}`,
      `Open findings: ${data.openFindings} of ${data.totalFindings} total`,
      `  Critical: ${severityCounts.Critical}`,
      `  High: ${severityCounts.High}`,
      `  Medium: ${severityCounts.Medium}`,
      `  Low: ${severityCounts.Low}`,
      `Recent scans: ${data.recentScans}`,
      `Weekly LLM spend: $${cost.toFixed(2)}`,
      data.lastScanAt ? `Last scan: ${data.lastScanAt}` : null,
      ``,
      `Click to open security dashboard`,
    ]
      .filter(Boolean)
      .join("\n");

    this.item.command = "devpulse.openSecurityPanel";
    this.item.show();
  }

  async refresh(isSignedIn: boolean): Promise<void> {
    if (!isSignedIn) {
      this.showSignedOut();
      return;
    }
    try {
      const [data, findings] = await Promise.all([
        this.api.getDashboardData(),
        this.api.getRecentFindings(20),
      ]);
      this.showSummary(data, findings);
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private getSeverityCounts(findings: Finding[]): Record<Severity, number> {
    return {
      Critical: findings.filter(f => f.severity === "Critical").length,
      High: findings.filter(f => f.severity === "High").length,
      Medium: findings.filter(f => f.severity === "Medium").length,
      Low: findings.filter(f => f.severity === "Low").length,
    };
  }
}
