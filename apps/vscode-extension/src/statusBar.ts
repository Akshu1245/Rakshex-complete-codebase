import * as vscode from "vscode";
import type { RakshexApi, DashboardData, Finding, Severity } from "./api";

/**
 * Status bar item showing Rakshex health at a glance.
 *   - not signed in  : "$(shield) Rakshex: Sign in"
 *   - signed in ok   : "$(shield) Rakshex: 2C 5H 3M"
 *   - error          : "$(alert) Rakshex: Error"
 *
 * Color changes based on risk level:
 *   - Green: no critical/high findings
 *   - Yellow: high findings present
 *   - Red: critical findings present
 */
export class RakshexStatusBar {
  private readonly item: vscode.StatusBarItem;
  private findings: Finding[] = [];

  constructor(
    private readonly api: RakshexApi,
    private readonly getStreak?: () => number,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.name = "Rakshex";
    this.item.command = "rakshex.openSecurityPanel";
  }

  dispose(): void {
    this.item.dispose();
  }

  showSignedOut(): void {
    this.item.text = "$(shield) Rakshex: Sign in";
    this.item.tooltip = "Click or run 'Rakshex: Sign in with API Key'";
    this.item.command = "rakshex.authenticate";
    this.item.color = undefined;
    this.item.backgroundColor = undefined;
    this.item.show();
  }

  showError(message: string): void {
    this.item.text = "$(alert) Rakshex";
    this.item.tooltip = `Rakshex error: ${message}`;
    this.item.command = "rakshex.refresh";
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
    const resolvedCount = findings.filter((f) => f.status === "resolved").length;

    this.item.text = `$(shield) ${findingsText}`;

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

    const streak = this.getStreak?.() ?? 0;
    const streakLine = streak > 1 ? `🔥 Scan streak: ${streak} days` : null;
    const openCritical = severityCounts.Critical;
    const openHigh = severityCounts.High;
    const nudgeLine =
      openCritical > 0 || openHigh > 0
        ? `💡 ${openCritical + openHigh} unresolved critical/high — a quick review keeps your APIs safer`
        : null;

    // Detailed tooltip focused on value, not cost
    this.item.tooltip = [
      `Rakshex Security Status`,
      ``,
      streakLine,
      streakLine ? `` : null,
      nudgeLine,
      nudgeLine ? `` : null,
      `Collections: ${data.collections}`,
      `Findings: ${data.openFindings} open · ${resolvedCount} resolved · ${data.totalFindings} total`,
      `  Critical: ${severityCounts.Critical}`,
      `  High: ${severityCounts.High}`,
      `  Medium: ${severityCounts.Medium}`,
      `  Low: ${severityCounts.Low}`,
      `Recent scans: ${data.recentScans}`,
      data.lastScanAt ? `Last scan: ${data.lastScanAt}` : null,
      ``,
      `Click to open security dashboard`,
    ]
      .filter(Boolean)
      .join("\n");

    this.item.command = "rakshex.openSecurityPanel";
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
      Critical: findings.filter((f) => f.severity === "Critical").length,
      High: findings.filter((f) => f.severity === "High").length,
      Medium: findings.filter((f) => f.severity === "Medium").length,
      Low: findings.filter((f) => f.severity === "Low").length,
    };
  }
}
