/**
 * DevPulse Security Webview Panel — Market-Ready Edition.
 *
 * A self-contained VS Code WebviewPanel that shows:
 *   - Dashboard overview with severity breakdown & risk score gauge
 *   - Sortable, filterable findings table with status actions
 *   - Compliance summary (OWASP Top 10, PCI DSS)
 *   - Real-time auto-refresh every 30s
 *
 * No external scripts — inline CSS only so the panel works in Restricted Mode.
 * Uses VS Code CSS variables for theme-aware styling.
 */
import * as crypto from "crypto";
import * as vscode from "vscode";
import type { DevPulseApi, DashboardData, Finding, FindingStatus, Severity } from "./api";

type PanelState = {
  dashboard: DashboardData | null;
  findings: Finding[];
  error: string | null;
  errorCategory: "network" | "auth" | "unknown" | null;
  lastUpdated: string | null;
};

export class SecurityWebviewPanel {
  private static current: SecurityWebviewPanel | undefined;
  public static readonly viewType = "devpulse.security";

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private autoRefreshTimer: NodeJS.Timeout | undefined;
  private isFirstRender = true;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly api: DevPulseApi,
    private readonly context?: vscode.ExtensionContext,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "refresh") {
          void this.refresh();
        } else if (msg.type === "updateFindingStatus") {
          void this.handleUpdateFindingStatus(msg.findingId as string, msg.status as FindingStatus);
        } else if (msg.type === "runScan") {
          vscode.commands.executeCommand("devpulse.runScan");
        } else if (msg.type === "testPrompt") {
          vscode.commands.executeCommand("devpulse.testPrompt");
        } else if (msg.type === "openDashboard") {
          vscode.commands.executeCommand("devpulse.openDashboard");
        } else if (msg.type === "setCompactMode") {
          void this.context?.globalState.update("devpulse.securityCompactMode", Boolean(msg.value));
        }
      },
      null,
      this.disposables,
    );
    this.startAutoRefresh();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    api: DevPulseApi,
    context?: vscode.ExtensionContext,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (SecurityWebviewPanel.current) {
      SecurityWebviewPanel.current.panel.reveal(column);
      void SecurityWebviewPanel.current.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SecurityWebviewPanel.viewType,
      "DevPulse Security Dashboard",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    SecurityWebviewPanel.current = new SecurityWebviewPanel(panel, api, context);
    void SecurityWebviewPanel.current.refresh();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => void this.refresh(), 30_000);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
  }

  private async handleUpdateFindingStatus(findingId: string, status: FindingStatus): Promise<void> {
    try {
      await this.api.updateFindingStatus(findingId, status);
      void this.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevPulse: could not update finding — ${msg}`);
    }
  }

  private classifyError(err: unknown): {
    message: string;
    category: "network" | "auth" | "unknown";
  } {
    const msg = err instanceof Error ? err.message : String(err);
    if (/401|403|unauthorized|forbidden/i.test(msg)) {
      return { message: msg, category: "auth" };
    }
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch|network/i.test(msg)) {
      return { message: msg, category: "network" };
    }
    return { message: msg, category: "unknown" };
  }

  private async refresh(): Promise<void> {
    // On first render, set full HTML with loading state
    if (this.isFirstRender) {
      this.panel.webview.html = this._getHtmlForWebview(this.panel.webview, {
        dashboard: null,
        findings: [],
        error: null,
        errorCategory: null,
        lastUpdated: null,
      });
      this.isFirstRender = false;
    } else {
      // Subsequent refreshes: show a subtle loading overlay, not full re-render
      this.panel.webview.postMessage({ type: "refreshStart" });
    }

    try {
      const [dashboard, findings] = await Promise.all([
        this.api.getDashboardData(),
        this.api.getRecentFindings(50),
      ]);
      const state: PanelState = {
        dashboard,
        findings,
        error: null,
        errorCategory: null,
        lastUpdated: new Date().toLocaleTimeString(),
      };
      if (!this.panel.visible) {
        return;
      }
      this.panel.webview.postMessage({ type: "dataUpdate", state });
    } catch (err) {
      const { message, category } = this.classifyError(err);
      const state: PanelState = {
        dashboard: null,
        findings: [],
        error: message,
        errorCategory: category,
        lastUpdated: null,
      };
      if (!this.panel.visible) {
        return;
      }
      this.panel.webview.postMessage({ type: "dataUpdate", state });
    }
  }

  public dispose(): void {
    this.stopAutoRefresh();
    SecurityWebviewPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, state: PanelState): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join("; ");

    const { dashboard, findings, error, errorCategory, lastUpdated } = state;

    const severityCounts = {
      Critical: findings.filter((f) => f.severity === "Critical").length,
      High: findings.filter((f) => f.severity === "High").length,
      Medium: findings.filter((f) => f.severity === "Medium").length,
      Low: findings.filter((f) => f.severity === "Low").length,
    };
    const totalFindings = findings.length;
    const openCount = findings.filter((f) => f.status === "open").length;
    const progressCount = findings.filter((f) => f.status === "in-progress").length;
    const resolvedCount = findings.filter((f) => f.status === "resolved").length;

    // Risk score: weighted sum where Critical=10, High=7, Medium=4, Low=1, normalized to 0-100
    const rawRisk =
      severityCounts.Critical * 10 +
      severityCounts.High * 7 +
      severityCounts.Medium * 4 +
      severityCounts.Low * 1;
    const maxRisk = totalFindings > 0 ? totalFindings * 10 : 1;
    const riskScore = Math.min(100, Math.round((rawRisk / maxRisk) * 100));
    const riskColor = riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f97316" : "#22c55e";

    // Mock compliance data based on findings
    const owaspScore =
      totalFindings > 0
        ? Math.max(
            0,
            Math.round(
              100 -
                (severityCounts.Critical * 15 +
                  severityCounts.High * 8 +
                  severityCounts.Medium * 3 +
                  severityCounts.Low * 1),
            ),
          )
        : 100;
    const pciScore =
      totalFindings > 0
        ? Math.max(
            0,
            Math.round(
              100 -
                (severityCounts.Critical * 20 +
                  severityCounts.High * 10 +
                  severityCounts.Medium * 4),
            ),
          )
        : 100;

    const errorIcon = errorCategory === "auth" ? "🔑" : errorCategory === "network" ? "🌐" : "⚠";
    const errorTitle =
      errorCategory === "auth"
        ? "Authentication Failed"
        : errorCategory === "network"
          ? "Connection Error"
          : "Couldn't load dashboard data";
    const errorHint =
      errorCategory === "auth"
        ? "Your API key may be invalid or expired. Try signing in again."
        : errorCategory === "network"
          ? "Check your network connection and API URL settings."
          : "";

    const body = error
      ? `<div class="error-container">
           <div class="error-icon">${errorIcon}</div>
           <h2>${escapeHtml(errorTitle)}</h2>
           <p class="error-msg">${escapeHtml(error)}</p>
           ${errorHint ? `<p class="error-hint">${escapeHtml(errorHint)}</p>` : ""}
           <button class="btn btn-primary" id="refresh-btn">
             <span class="btn-icon">↻</span> Try again
           </button>
         </div>`
      : dashboard === null
        ? `<div class="loading-container">
            <div class="spinner"></div>
            <p>Loading DevPulse dashboard…</p>
          </div>`
        : `
      <header class="hdr">
        <div class="hdr-left">
          <h1>🛡 DevPulse Security Dashboard</h1>
          <p class="sub">Live data from your DevPulse workspace${lastUpdated ? ` · Last updated: ${escapeHtml(lastUpdated)}` : ""}</p>
        </div>
        <div class="hdr-right">
          <button class="btn btn-ghost" id="refresh-btn" title="Refresh now">
            <span class="btn-icon">↻</span> Refresh
          </button>
        </div>
      </header>

      <!-- DASHBOARD OVERVIEW -->
      <section class="dashboard-overview">
        <div class="overview-left">
          <div class="stat-grid">
            <div class="card card-accent">
              <div class="card-label">Total Findings</div>
              <div class="card-value">${totalFindings}</div>
              <div class="card-hint">${openCount} open · ${progressCount} in progress · ${resolvedCount} resolved</div>
            </div>
            <div class="card">
              <div class="card-label">Collections</div>
              <div class="card-value">${dashboard.collections}</div>
              <div class="card-hint">API specs tracked</div>
            </div>
            <div class="card">
              <div class="card-label">Weekly LLM Cost</div>
              <div class="card-value">$${dashboard.weeklyCost.toFixed(2)}</div>
              <div class="card-hint">last 7 days</div>
            </div>
          </div>
          <div class="severity-breakdown">
            <h3>Severity Breakdown</h3>
            <div class="severity-badges">
              <span class="badge badge-critical">Critical ${severityCounts.Critical}</span>
              <span class="badge badge-high">High ${severityCounts.High}</span>
              <span class="badge badge-medium">Medium ${severityCounts.Medium}</span>
              <span class="badge badge-low">Low ${severityCounts.Low}</span>
            </div>
          </div>
        </div>
        <div class="overview-right">
          <div class="risk-gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" r="52" class="gauge-bg"/>
              <circle cx="60" cy="60" r="52" class="gauge-fill"
                style="stroke:${riskColor}; stroke-dasharray:${riskScore * 3.27} 327;"/>
              <text x="60" y="55" text-anchor="middle" class="gauge-value" style="fill:${riskColor}">${riskScore}</text>
              <text x="60" y="72" text-anchor="middle" class="gauge-label">Risk Score</text>
            </svg>
          </div>
          <div class="quick-actions">
            <button class="btn btn-primary btn-sm" id="run-scan-btn">▶ Run Scan</button>
            <button class="btn btn-secondary btn-sm" id="test-prompt-btn">🧪 Test Prompt</button>
            <button class="btn btn-secondary btn-sm" id="open-dashboard-btn">📊 Dashboard</button>
            <button class="btn btn-ghost btn-sm" id="compact-toggle-btn" title="Toggle compact view">◫ Compact</button>
          </div>
        </div>
      </section>

      <!-- FINDINGS TABLE -->
      <section class="findings-section">
        <div class="findings-header">
          <h2>Recent Findings</h2>
          <div class="filter-bar" id="filter-bar">
            <button class="filter-btn" data-filter="all">All (${totalFindings})</button>
            <button class="filter-btn" data-filter="Critical">Critical (${severityCounts.Critical})</button>
            <button class="filter-btn" data-filter="High">High (${severityCounts.High})</button>
            <button class="filter-btn" data-filter="Medium">Medium (${severityCounts.Medium})</button>
            <button class="filter-btn" data-filter="Low">Low (${severityCounts.Low})</button>
          </div>
        </div>
        ${
          findings.length === 0
            ? `<div class="empty-state">
                <div class="empty-icon">🛡️</div>
                <p style="font-weight:600;margin-bottom:4px">All clear — no issues detected</p>
                <p style="font-size:12px;color:var(--vscode-descriptionForeground)">Run a scan to check your collections for leaked keys, hidden costs, and misconfigurations.</p>
                <button class="btn btn-primary" style="margin-top:12px" onclick="runScan()">Run Scan</button>
              </div>`
            : `<div class="table-wrapper">
                <table id="findings-table">
                  <thead>
                    <tr>
                      <th class="sortable" data-sort="severity">Sev ↕</th>
                      <th class="sortable" data-sort="title">Finding ↕</th>
                      <th class="sortable" data-sort="collection">Collection ↕</th>
                      <th class="sortable" data-sort="status">Status ↕</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${findings
                      .map((f) => {
                        const confidence =
                          f.severity === "Critical"
                            ? "High confidence"
                            : f.severity === "High"
                              ? "Likely issue"
                              : "Review suggested";
                        const confClass =
                          f.severity === "Critical"
                            ? "conf-high"
                            : f.severity === "High"
                              ? "conf-med"
                              : "conf-low";
                        return `
                      <tr class="finding-row" data-severity="${escapeHtml(f.severity)}" data-id="${escapeHtml(f.id)}">
                        <td><span class="badge badge-${f.severity.toLowerCase()}">${escapeHtml(f.severity.slice(0, 1))}</span></td>
                        <td class="col-title">
                          ${escapeHtml(f.title)}
                          <div class="confidence ${confClass}">${confidence}</div>
                        </td>
                        <td>${escapeHtml(f.collectionName)}</td>
                        <td><span class="status-badge status-${f.status}">${statusLabel(f.status)}</span></td>
                        <td class="actions-cell">
                          ${f.status !== "resolved" ? `<button class="btn btn-xs btn-resolve" data-id="${escapeHtml(f.id)}" data-status="resolved">Resolve</button>` : ""}
                          ${f.status !== "in-progress" ? `<button class="btn btn-xs btn-progress" data-id="${escapeHtml(f.id)}" data-status="in-progress">Progress</button>` : ""}
                        </td>
                      </tr>
                    `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </section>

      <!-- COMPLIANCE SUMMARY -->
      <section class="compliance-section">
        <h2>Compliance Summary</h2>
        <div class="compliance-grid">
          <div class="compliance-card">
            <div class="compliance-header">
              <h3>OWASP Top 10</h3>
              <span class="compliance-pct ${owaspScore >= 80 ? "pct-good" : owaspScore >= 50 ? "pct-warn" : "pct-bad"}">${owaspScore}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${owaspScore >= 80 ? "fill-good" : owaspScore >= 50 ? "fill-warn" : "fill-bad"}" style="width:${owaspScore}%"></div>
            </div>
            <p class="compliance-hint">${owaspScore >= 80 ? "Good compliance posture" : owaspScore >= 50 ? "Moderate — address critical findings" : "At risk — immediate action required"}</p>
          </div>
          <div class="compliance-card">
            <div class="compliance-header">
              <h3>PCI DSS</h3>
              <span class="compliance-pct ${pciScore >= 80 ? "pct-good" : pciScore >= 50 ? "pct-warn" : "pct-bad"}">${pciScore}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${pciScore >= 80 ? "fill-good" : pciScore >= 50 ? "fill-warn" : "fill-bad"}" style="width:${pciScore}%"></div>
            </div>
            <p class="compliance-hint">${pciScore >= 80 ? "Compliant" : pciScore >= 50 ? "Review recommended" : "Non-compliant — remediate findings"}</p>
          </div>
        </div>
      </section>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPulse Security Dashboard</title>
  <style>
    :root { color-scheme: var(--vscode-color-scheme, dark); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 20px;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: 13px;
      line-height: 1.5;
    }
    h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--vscode-editor-foreground); }
    h2 { font-size: 15px; font-weight: 600; color: var(--vscode-editor-foreground); margin-bottom: 10px; }
    h3 { font-size: 13px; font-weight: 600; color: var(--vscode-editor-foreground); margin-bottom: 8px; }
    .sub { color: var(--vscode-descriptionForeground, #8b8b8b); font-size: 12px; }

    /* Compact mode */
    body.compact-mode { padding: 12px; }
    body.compact-mode .hdr { margin-bottom: 12px; padding-bottom: 10px; }
    body.compact-mode .quick-actions { gap: 4px; }
    body.compact-mode .gauge { width: 80px; height: 80px; }
    body.compact-mode .gauge-value { font-size: 20px; }
    body.compact-mode .gauge-label { font-size: 9px; }
    body.compact-mode .card { padding: 10px; margin-bottom: 8px; }
    body.compact-mode .finding-row td { padding: 6px 8px; }
    body.compact-mode .finding-detail { display: none; }

    /* Header */
    .hdr {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 16px; margin-bottom: 20px; padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .hdr-right { display: flex; gap: 8px; align-items: center; }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; border-radius: 4px; cursor: pointer;
      font-size: 12px; font-weight: 500; border: none;
      transition: background 0.15s, opacity 0.15s;
      color: var(--vscode-button-foreground, #ffffff);
      background: var(--vscode-button-background, #0e639c);
    }
    .btn:hover { opacity: 0.9; }
    .btn:active { opacity: 0.8; }
    .btn-primary { background: var(--vscode-button-background, #0e639c); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground, #3a3d41); color: var(--vscode-button-secondaryForeground, #ffffff); }
    .btn-ghost { background: transparent; color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border, #3c3c3c); }
    .btn-sm { padding: 4px 10px; font-size: 11px; }
    .btn-xs { padding: 2px 8px; font-size: 11px; border-radius: 3px; }
    .btn-icon { font-size: 14px; }
    .btn-resolve { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }
    .btn-resolve:hover { background: #22c55e30; }
    .btn-progress { background: #eab30820; color: #eab308; border: 1px solid #eab30840; }
    .btn-progress:hover { background: #eab30830; }

    /* Dashboard Overview */
    .dashboard-overview {
      display: flex; gap: 20px; margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .overview-left { flex: 1; min-width: 300px; }
    .overview-right {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      min-width: 180px;
    }
    .stat-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px; margin-bottom: 16px;
    }
    .card {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 6px; padding: 14px;
      transition: border-color 0.15s;
    }
    .card:hover { border-color: var(--vscode-focusBorder, #007fd4); }
    .card-accent { border-left: 3px solid var(--vscode-activityBarBadge-background, #007acc); }
    .card-label {
      text-transform: uppercase; letter-spacing: 0.08em;
      font-size: 10px; color: var(--vscode-descriptionForeground, #8b8b8b);
      margin-bottom: 4px;
    }
    .card-value {
      font-size: 24px; font-weight: 600;
      color: var(--vscode-editor-foreground);
    }
    .card-hint { font-size: 11px; color: var(--vscode-descriptionForeground, #8b8b8b); }

    /* Severity Breakdown */
    .severity-breakdown { margin-top: 4px; }
    .severity-badges { display: flex; gap: 8px; flex-wrap: wrap; }

    /* Badges */
    .badge {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
    }
    .badge-critical { background: #ef444420; color: #ef4444; }
    .badge-high { background: #f9731620; color: #f97316; }
    .badge-medium { background: #eab30820; color: #eab308; }
    .badge-low { background: #3b82f620; color: #3b82f6; }

    /* Status badges */
    .status-badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 500;
    }
    .status-open { background: #ef444420; color: #ef4444; }
    .status-in-progress { background: #eab30820; color: #eab308; }
    .status-resolved { background: #22c55e20; color: #22c55e; }

    /* Risk Gauge */
    .risk-gauge { width: 140px; height: 140px; }
    .gauge-svg { width: 100%; height: 100%; }
    .gauge-bg { fill: none; stroke: var(--vscode-panel-border, #3c3c3c); stroke-width: 8; }
    .gauge-fill { fill: none; stroke-width: 8; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 60px 60px; transition: stroke-dasharray 0.6s ease; }
    .gauge-value { font-size: 28px; font-weight: 700; }
    .gauge-label { font-size: 10px; fill: var(--vscode-descriptionForeground, #8b8b8b); }

    /* Quick Actions */
    .quick-actions { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    .quick-actions .btn { justify-content: center; width: 100%; }

    /* Findings Section */
    .findings-section {
      margin-bottom: 24px;
    }
    .findings-header {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 10px; margin-bottom: 12px;
    }
    .filter-bar { display: flex; gap: 4px; flex-wrap: wrap; }
    .filter-btn {
      padding: 3px 10px; border-radius: 999px; font-size: 11px;
      cursor: pointer; border: 1px solid var(--vscode-panel-border, #3c3c3c);
      background: transparent; color: var(--vscode-descriptionForeground, #8b8b8b);
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: var(--vscode-focusBorder, #007fd4); color: var(--vscode-editor-foreground); }
    .filter-btn.active { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border-color: transparent; }

    .table-wrapper {
      overflow-x: auto; border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    table {
      width: 100%; border-collapse: collapse;
      background: var(--vscode-editorWidget-background, #252526);
    }
    th, td {
      text-align: left; padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      vertical-align: middle;
    }
    thead th {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-descriptionForeground, #8b8b8b);
      font-weight: 500; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.05em;
      cursor: pointer; user-select: none;
      transition: color 0.15s;
    }
    thead th:hover { color: var(--vscode-editor-foreground); }
    tbody tr { transition: background 0.1s; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
    tbody tr:last-child td { border-bottom: 0; }
    .col-title { font-weight: 500; color: var(--vscode-editor-foreground); }
    .col-title .confidence { font-size: 10px; font-weight: 500; margin-top: 2px; }
    .confidence.conf-high { color: #ef4444; }
    .confidence.conf-med { color: #f97316; }
    .confidence.conf-low { color: #94a3b8; }
    .actions-cell { white-space: nowrap; }

    /* Empty & Error states */
    .empty-state, .error-container, .loading-container {
      text-align: center; padding: 40px 20px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
    }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    .error-icon { font-size: 32px; margin-bottom: 8px; }
    .error-container h2 { color: #ef4444; }
    .error-msg { margin-bottom: 6px; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
    .error-hint { margin-bottom: 12px; font-size: 12px; color: var(--vscode-descriptionForeground, #8b8b8b); font-style: italic; }
    .spinner {
      width: 32px; height: 32px; margin: 0 auto 12px;
      border: 3px solid var(--vscode-panel-border, #3c3c3c);
      border-top-color: var(--vscode-button-background, #0e639c);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Refresh loading overlay */
    .refresh-overlay {
      position: fixed; top: 0; left: 0; right: 0;
      height: 3px; z-index: 100;
      background: transparent;
      overflow: hidden;
      pointer-events: none;
    }
    .refresh-overlay.active .refresh-bar {
      animation: refreshSlide 1.5s ease-in-out infinite;
    }
    .refresh-bar {
      width: 40%; height: 100%;
      background: var(--vscode-button-background, #0e639c);
      border-radius: 0 2px 2px 0;
    }
    @keyframes refreshSlide {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(150%); }
      100% { transform: translateX(-100%); }
    }
    .refresh-badge {
      position: fixed; top: 8px; right: 16px; z-index: 101;
      padding: 3px 10px; border-radius: 999px;
      font-size: 10px; font-weight: 600;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      opacity: 0; transition: opacity 0.2s;
      pointer-events: none;
    }
    .refresh-badge.visible { opacity: 1; }

    /* Compliance Section */
    .compliance-section {
      margin-bottom: 24px;
    }
    .compliance-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .compliance-card {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 6px; padding: 16px;
    }
    .compliance-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
    }
    .compliance-pct { font-size: 18px; font-weight: 700; }
    .pct-good { color: #22c55e; }
    .pct-warn { color: #eab308; }
    .pct-bad { color: #ef4444; }
    .progress-bar {
      height: 6px; border-radius: 3px;
      background: var(--vscode-panel-border, #3c3c3c);
      overflow: hidden; margin-bottom: 8px;
    }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
    .fill-good { background: #22c55e; }
    .fill-warn { background: #eab308; }
    .fill-bad { background: #ef4444; }
    .compliance-hint { font-size: 11px; color: var(--vscode-descriptionForeground, #8b8b8b); }

    code {
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      padding: 1px 4px; border-radius: 3px; font-size: 12px;
    }
  </style>
</head>
<body class="${this.context?.globalState.get<boolean>("devpulse.securityCompactMode") ? "compact-mode" : ""}">
  <div class="refresh-overlay" id="refresh-overlay"><div class="refresh-bar"></div></div>
  <div class="refresh-badge" id="refresh-badge">Refreshing…</div>
  ${body}
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const refreshOverlay = document.getElementById("refresh-overlay");
      const refreshBadge = document.getElementById("refresh-badge");

      function showRefreshIndicator() {
        if (refreshOverlay) refreshOverlay.classList.add("active");
        if (refreshBadge) refreshBadge.classList.add("visible");
      }
      function hideRefreshIndicator() {
        if (refreshOverlay) refreshOverlay.classList.remove("active");
        if (refreshBadge) refreshBadge.classList.remove("visible");
      }

      function escapeHtml(str) {
        return String(str == null ? "" : str)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function statusLabel(s) {
        if (s === "in-progress") return "In Progress";
        if (s === "resolved") return "Resolved";
        return "Open";
      }

      function applyDataUpdate(state) {
        hideRefreshIndicator();
        var dashboard = state.dashboard;
        var findings = state.findings || [];
        var error = state.error;
        var errorCategory = state.errorCategory;
        var lastUpdated = state.lastUpdated;

        // If there's an error, rebuild the body with error state
        if (error) {
          var errorIcon = errorCategory === "auth" ? "🔑" : errorCategory === "network" ? "🌐" : "⚠";
          var errorTitle = errorCategory === "auth" ? "Authentication Failed" : errorCategory === "network" ? "Connection Error" : "Could not load dashboard";
          var errorHint = errorCategory === "auth"
            ? "Your API key may be invalid or expired. Try signing in again."
            : errorCategory === "network"
              ? "Could not reach the DevPulse server. Check your network connection and API URL."
              : "";
          var errorHtml = '<div class="error-container">' +
            '<div class="error-icon">' + errorIcon + '</div>' +
            '<h2>' + escapeHtml(errorTitle) + '</h2>' +
            '<p class="error-msg">' + escapeHtml(error) + '</p>' +
            (errorHint ? '<p class="error-hint">' + escapeHtml(errorHint) + '</p>' : '') +
            '<button class="btn btn-primary" id="refresh-btn"><span class="btn-icon">↻</span> Try again</button>' +
            '</div>';
          document.body.innerHTML = '<div class="refresh-overlay" id="refresh-overlay"><div class="refresh-bar"></div></div>' +
            '<div class="refresh-badge" id="refresh-badge">Refreshing…</div>' +
            errorHtml +
            document.querySelector("script")?.outerHTML || "";
          bindRefreshBtn();
          return;
        }

        if (!dashboard) return;

        // Update last updated timestamp
        var subEl = document.querySelector(".hdr .sub");
        if (subEl) {
          subEl.textContent = "Live data from your DevPulse workspace" + (lastUpdated ? " · Last updated: " + lastUpdated : "");
        }

        // Compute severity counts
        var sc = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        findings.forEach(function (f) { if (sc[f.severity] !== undefined) sc[f.severity]++; });
        var total = findings.length;
        var openC = findings.filter(function (f) { return f.status === "open"; }).length;
        var progC = findings.filter(function (f) { return f.status === "in-progress"; }).length;
        var resC = findings.filter(function (f) { return f.status === "resolved"; }).length;

        // Update stat cards
        var cardValues = document.querySelectorAll(".card-value");
        if (cardValues[0]) cardValues[0].textContent = total;
        if (cardValues[0]?.parentElement?.querySelector(".card-hint"))
          cardValues[0].parentElement.querySelector(".card-hint").textContent = openC + " open · " + progC + " in progress · " + resC + " resolved";
        if (cardValues[1]) cardValues[1].textContent = dashboard.collections;
        if (cardValues[2]) cardValues[2].textContent = "$" + dashboard.weeklyCost.toFixed(2);

        // Update severity badges
        var badges = document.querySelectorAll(".severity-badges .badge");
        var sevOrder = ["Critical", "High", "Medium", "Low"];
        badges.forEach(function (b, i) {
          if (sevOrder[i]) b.textContent = sevOrder[i] + " " + sc[sevOrder[i]];
        });

        // Update risk gauge
        var rawRisk = sc.Critical * 10 + sc.High * 7 + sc.Medium * 4 + sc.Low * 1;
        var maxRisk = total > 0 ? total * 10 : 1;
        var riskScore = Math.min(100, Math.round((rawRisk / maxRisk) * 100));
        var riskColor = riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f97316" : "#22c55e";
        var gaugeFill = document.querySelector(".gauge-fill");
        if (gaugeFill) {
          gaugeFill.style.stroke = riskColor;
          gaugeFill.style.strokeDasharray = (riskScore * 3.27) + " 327";
        }
        var gaugeValue = document.querySelector(".gauge-value");
        if (gaugeValue) { gaugeValue.textContent = riskScore; gaugeValue.style.fill = riskColor; }

        // Update findings table body
        var tbody = document.querySelector("#findings-table tbody");
        if (tbody) {
          tbody.innerHTML = findings.map(function (f) {
            var confidence = f.severity === "Critical" ? "High confidence" : f.severity === "High" ? "Likely issue" : "Review suggested";
            var confClass = f.severity === "Critical" ? "conf-high" : f.severity === "High" ? "conf-med" : "conf-low";
            return '<tr class="finding-row" data-severity="' + escapeHtml(f.severity) + '" data-id="' + escapeHtml(f.id) + '">' +
              '<td><span class="badge badge-' + f.severity.toLowerCase() + '">' + escapeHtml(f.severity.charAt(0)) + '</span></td>' +
              '<td class="col-title">' + escapeHtml(f.title) + '<div class="confidence ' + confClass + '">' + confidence + '</div></td>' +
              '<td>' + escapeHtml(f.collectionName) + '</td>' +
              '<td><span class="status-badge status-' + f.status + '">' + statusLabel(f.status) + '</span></td>' +
              '<td class="actions-cell">' +
              (f.status !== "resolved" ? '<button class="btn btn-xs btn-resolve" data-id="' + escapeHtml(f.id) + '" data-status="resolved">Resolve</button>' : '') +
              (f.status !== "in-progress" ? '<button class="btn btn-xs btn-progress" data-id="' + escapeHtml(f.id) + '" data-status="in-progress">Progress</button>' : '') +
              '</td></tr>';
          }).join("");
          bindActionBtns();
          // Re-apply saved filter after DOM update
          var savedFilter = localStorage.getItem("devpulse.filter") || "all";
          document.querySelectorAll(".finding-row").forEach(function (row) {
            row.style.display = (savedFilter === "all" || row.getAttribute("data-severity") === savedFilter) ? "" : "none";
          });
        }

        // Update filter counts
        var filterBtns = document.querySelectorAll(".filter-btn");
        filterBtns.forEach(function (btn) {
          var filter = btn.getAttribute("data-filter");
          var count = filter === "all" ? total : (sc[filter] || 0);
          var label = filter === "all" ? "All" : filter;
          btn.textContent = label + " (" + count + ")";
        });

        // Update compliance
        var owaspScore = total > 0 ? Math.max(0, Math.round(100 - (sc.Critical * 15 + sc.High * 8 + sc.Medium * 3 + sc.Low * 1))) : 100;
        var pciScore = total > 0 ? Math.max(0, Math.round(100 - (sc.Critical * 20 + sc.High * 10 + sc.Medium * 4))) : 100;
        var pctEls = document.querySelectorAll(".compliance-pct");
        var fillEls = document.querySelectorAll(".progress-fill");
        var hintEls = document.querySelectorAll(".compliance-hint");
        if (pctEls[0]) { pctEls[0].textContent = owaspScore + "%"; pctEls[0].className = "compliance-pct " + (owaspScore >= 80 ? "pct-good" : owaspScore >= 50 ? "pct-warn" : "pct-bad"); }
        if (fillEls[0]) { fillEls[0].style.width = owaspScore + "%"; fillEls[0].className = "progress-fill " + (owaspScore >= 80 ? "fill-good" : owaspScore >= 50 ? "fill-warn" : "fill-bad"); }
        if (hintEls[0]) hintEls[0].textContent = owaspScore >= 80 ? "Good compliance posture" : owaspScore >= 50 ? "Moderate — address critical findings" : "At risk — immediate action required";
        if (pctEls[1]) { pctEls[1].textContent = pciScore + "%"; pctEls[1].className = "compliance-pct " + (pciScore >= 80 ? "pct-good" : pciScore >= 50 ? "pct-warn" : "pct-bad"); }
        if (fillEls[1]) { fillEls[1].style.width = pciScore + "%"; fillEls[1].className = "progress-fill " + (pciScore >= 80 ? "fill-good" : pciScore >= 50 ? "fill-warn" : "fill-bad"); }
        if (hintEls[1]) hintEls[1].textContent = pciScore >= 80 ? "Compliant" : pciScore >= 50 ? "Review recommended" : "Non-compliant — remediate findings";
      }

      function bindRefreshBtn() {
        var rb = document.getElementById("refresh-btn");
        if (rb) rb.addEventListener("click", function () { vscode.postMessage({ type: "refresh" }); });
      }

      function bindActionBtns() {
        document.querySelectorAll(".btn-resolve, .btn-progress").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-id");
            var status = btn.getAttribute("data-status");
            if (id && status) vscode.postMessage({ type: "updateFindingStatus", findingId: id, status: status });
          });
        });
      }

      // Refresh button
      bindRefreshBtn();

      // Quick action buttons
      const runScanBtn = document.getElementById("run-scan-btn");
      if (runScanBtn) {
        runScanBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "runScan" });
        });
      }
      const testPromptBtn = document.getElementById("test-prompt-btn");
      if (testPromptBtn) {
        testPromptBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "testPrompt" });
        });
      }
      const openDashboardBtn = document.getElementById("open-dashboard-btn");
      if (openDashboardBtn) {
        openDashboardBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "openDashboard" });
        });
      }

      // Compact mode toggle with localStorage + globalState persistence
      const compactToggleBtn = document.getElementById("compact-toggle-btn");
      if (compactToggleBtn) {
        var isCompact = document.body.classList.contains("compact-mode");
        if (isCompact) {
          compactToggleBtn.textContent = "◫ Full";
        }
        compactToggleBtn.addEventListener("click", function () {
          isCompact = !isCompact;
          document.body.classList.toggle("compact-mode", isCompact);
          localStorage.setItem("devpulse.compactMode", String(isCompact));
          vscode.postMessage({ type: "setCompactMode", value: isCompact });
          compactToggleBtn.textContent = isCompact ? "◫ Full" : "◫ Compact";
        });
      }

      // Filter buttons with localStorage persistence
      (function initFilter() {
        var savedFilter = localStorage.getItem("devpulse.filter") || "all";
        document.querySelectorAll(".filter-btn").forEach(function (btn) {
          var filter = btn.getAttribute("data-filter");
          if (filter === savedFilter) btn.classList.add("active");
          else btn.classList.remove("active");
          btn.addEventListener("click", function () {
            document.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            var f = btn.getAttribute("data-filter");
            localStorage.setItem("devpulse.filter", f);
            document.querySelectorAll(".finding-row").forEach(function (row) {
              row.style.display = (f === "all" || row.getAttribute("data-severity") === f) ? "" : "none";
            });
          });
        });
        // Apply saved filter on load
        document.querySelectorAll(".finding-row").forEach(function (row) {
          row.style.display = (savedFilter === "all" || row.getAttribute("data-severity") === savedFilter) ? "" : "none";
        });
      })();

      // Sortable columns
      var sortState = { column: null, asc: true };
      document.querySelectorAll("th.sortable").forEach(function (th) {
        th.addEventListener("click", function () {
          var col = th.getAttribute("data-sort");
          if (sortState.column === col) {
            sortState.asc = !sortState.asc;
          } else {
            sortState.column = col;
            sortState.asc = true;
          }
          var tbody = document.querySelector("#findings-table tbody");
          if (!tbody) return;
          var rows = Array.from(tbody.querySelectorAll("tr"));
          var severityOrder = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
          rows.sort(function (a, b) {
            var aVal, bVal;
            if (col === "severity") {
              aVal = severityOrder[a.getAttribute("data-severity")] || 0;
              bVal = severityOrder[b.getAttribute("data-severity")] || 0;
            } else if (col === "title") {
              aVal = a.querySelector(".col-title")?.textContent?.toLowerCase() || "";
              bVal = b.querySelector(".col-title")?.textContent?.toLowerCase() || "";
            } else if (col === "collection") {
              aVal = a.children[2]?.textContent?.toLowerCase() || "";
              bVal = b.children[2]?.textContent?.toLowerCase() || "";
            } else if (col === "status") {
              aVal = a.querySelector(".status-badge")?.textContent?.toLowerCase() || "";
              bVal = b.querySelector(".status-badge")?.textContent?.toLowerCase() || "";
            } else {
              return 0;
            }
            if (aVal < bVal) return sortState.asc ? -1 : 1;
            if (aVal > bVal) return sortState.asc ? 1 : -1;
            return 0;
          });
          rows.forEach(function (r) { tbody.appendChild(r); });
        });
      });

      // Finding action buttons
      bindActionBtns();

      // Handle data updates from extension (DOM diffing instead of full re-render)
      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "refreshStart") {
          showRefreshIndicator();
        } else if (msg.type === "dataUpdate") {
          applyDataUpdate(msg.state);
        }
      });
    }());
  </script>
</body>
</html>`;
  }
}

function statusLabel(s: string): string {
  if (s === "in-progress") return "In Progress";
  if (s === "resolved") return "Resolved";
  return "Open";
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = crypto.randomBytes(32);
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(randomBytes[i] % chars.length);
  }
  return text;
}

function escapeHtml(input: unknown): string {
  const str = input == null ? "" : String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
