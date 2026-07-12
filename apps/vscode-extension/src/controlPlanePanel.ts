import * as vscode from "vscode";
import type { ControlPlaneSummary, ControlPlaneUsage, RakshexApi } from "./api";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!,
  );
}

export class ControlPlanePanel {
  private panel?: vscode.WebviewPanel;

  constructor(private readonly api: RakshexApi) {}

  async show(workspaceId: number): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "rakshex.controlPlane",
        "Rakshex AI Control Plane",
        vscode.ViewColumn.One,
        { enableScripts: false },
      );
      this.panel.onDidDispose(() => (this.panel = undefined));
    }

    this.panel.webview.html = this.renderLoading();
    try {
      const [summary, usage, subscriptions] = await Promise.all([
        this.api.getControlPlaneSummary(workspaceId),
        this.api.getControlPlaneUsage(workspaceId),
        this.api.getControlPlaneSubscriptions(workspaceId),
      ]);
      this.panel.webview.html = this.render(workspaceId, summary, usage, subscriptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel.webview.html = this.renderError(message);
    }
  }

  private renderLoading(): string {
    return this.shell("Loading workspace governance data...");
  }

  private renderError(message: string): string {
    return this.shell(
      `<strong>Could not load the control plane.</strong><br>${escapeHtml(message)}`,
    );
  }

  private shell(content: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:24px;line-height:1.45}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(110px,1fr));gap:12px;margin:18px 0 26px}.card{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:14px;background:var(--vscode-editor-background)}
      .value{font-size:24px;font-weight:700;color:#14b8a6}.label{font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px}table{width:100%;border-collapse:collapse;margin:10px 0 24px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}th{color:var(--vscode-descriptionForeground)}.warn{color:#f59e0b}.muted{color:var(--vscode-descriptionForeground)}
    </style></head><body><h1>AI Control Plane</h1><p class="muted">${content}</p></body></html>`;
  }

  private render(
    workspaceId: number,
    summary: ControlPlaneSummary,
    usage: ControlPlaneUsage,
    subscriptions: Array<{
      provider: string;
      plan: string;
      seatsPurchased: number;
      seatsUsed: number;
      status: string;
    }>,
  ): string {
    const cards = [
      [summary.providers, "Provider accounts"],
      [summary.credentials, "Active credentials"],
      [summary.subscriptions, "Team subscriptions"],
      [summary.openFindings, "Open findings"],
    ]
      .map(
        ([value, label]) =>
          `<div class="card"><div class="value">${value}</div><div class="label">${label}</div></div>`,
      )
      .join("");
    const subscriptionRows = subscriptions.length
      ? subscriptions
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.provider)}</td><td>${escapeHtml(item.plan)}</td><td>${item.seatsUsed}/${item.seatsPurchased}</td><td>${escapeHtml(item.status)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No subscription inventory imported for this workspace.</td></tr>`;
    const userRows = usage.byUser.length
      ? usage.byUser
          .slice(0, 8)
          .map(
            (user) =>
              `<tr><td>${escapeHtml(user.name || user.email || "Unknown")}</td><td>${user.requests}</td><td>${user.tokens.toLocaleString()}</td><td>$${user.costUsd.toFixed(4)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No governed gateway usage recorded yet.</td></tr>`;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:24px;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(4,minmax(110px,1fr));gap:12px;margin:18px 0 26px}.card{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:14px;background:var(--vscode-editor-background)}.value{font-size:24px;font-weight:700;color:#14b8a6}.label{font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px}table{width:100%;border-collapse:collapse;margin:10px 0 24px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}th{color:var(--vscode-descriptionForeground)}.muted{color:var(--vscode-descriptionForeground)}
    </style></head><body><h1>AI Control Plane</h1><p class="muted">Workspace ${workspaceId}. Inventory and usage metadata only; raw prompts and provider credentials are not displayed.</p><div class="grid">${cards}</div><h2>Subscription seats</h2><table><thead><tr><th>Provider</th><th>Plan</th><th>Seats</th><th>Status</th></tr></thead><tbody>${subscriptionRows}</tbody></table><h2>Governed usage</h2><p class="muted">${usage.totalRequests.toLocaleString()} requests, ${usage.totalTokens.toLocaleString()} tokens, $${usage.totalCostUsd.toFixed(4)} estimated cost.</p><table><thead><tr><th>User</th><th>Requests</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>${userRows}</tbody></table></body></html>`;
  }
}
