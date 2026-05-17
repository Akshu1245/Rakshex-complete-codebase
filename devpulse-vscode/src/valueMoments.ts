/**
 * DevPulse "Saved Me" Product Moments
 *
 * Generates emotional retention loops by surfacing value delivered.
 */

import * as vscode from "vscode";

interface ValueEvent {
  type: "money_saved" | "threat_blocked" | "secret_found" | "agent_stopped" | "cost_alert";
  value: number; // dollars or count
  description: string;
  timestamp: number;
}

const STORAGE_KEY = "devpulse.valueEvents";

export class ValueMomentTracker {
  private events: ValueEvent[] = [];

  constructor(private context: vscode.ExtensionContext) {
    const saved = context.globalState.get<ValueEvent[]>(STORAGE_KEY);
    this.events = saved ?? [];
  }

  record(event: Omit<ValueEvent, "timestamp">): void {
    const fullEvent: ValueEvent = { ...event, timestamp: Date.now() };
    this.events.push(fullEvent);
    // Keep last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
    void this.context.globalState.update(STORAGE_KEY, this.events);
    this.showToast(fullEvent);
  }

  private showToast(event: ValueEvent): void {
    switch (event.type) {
      case "money_saved":
        void vscode.window.showInformationMessage(
          `💰 DevPulse saved you $${event.value.toFixed(2)} this week in hidden AI costs.`,
        );
        break;
      case "agent_stopped":
        void vscode.window.showWarningMessage(
          `🛑 DevPulse stopped a rogue agent after ${event.value} calls. Potential savings: $${event.description}.`,
        );
        break;
      case "secret_found":
        void vscode.window.showWarningMessage(
          `🔓 DevPulse found ${event.value} exposed secret(s) in your collection. Rotate them immediately.`,
        );
        break;
      case "threat_blocked":
        void vscode.window.showInformationMessage(
          `🛡️ DevPulse blocked a ${event.description} attack vector.`,
        );
        break;
      case "cost_alert":
        void vscode.window.showWarningMessage(
          `📈 AI spend is ${event.value}% higher than last week. Review your dashboard.`,
        );
        break;
    }
  }

  getWeeklySummary(): {
    moneySaved: number;
    agentsStopped: number;
    secretsFound: number;
    threatsBlocked: number;
  } {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekly = this.events.filter((e) => e.timestamp > oneWeekAgo);

    return {
      moneySaved: weekly.filter((e) => e.type === "money_saved").reduce((s, e) => s + e.value, 0),
      agentsStopped: weekly.filter((e) => e.type === "agent_stopped").length,
      secretsFound: weekly
        .filter((e) => e.type === "secret_found")
        .reduce((s, e) => s + e.value, 0),
      threatsBlocked: weekly.filter((e) => e.type === "threat_blocked").length,
    };
  }

  showWeeklySummaryPanel(): void {
    const summary = this.getWeeklySummary();
    const panel = vscode.window.createWebviewPanel(
      "devpulse.weeklySummary",
      "DevPulse Weekly Protection Summary",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); }
    .card { background: var(--vscode-button-secondaryBackground); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .value { font-size: 28px; font-weight: bold; color: #22c55e; }
    .label { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .hero { text-align: center; margin-bottom: 24px; }
    .hero-title { font-size: 18px; font-weight: bold; }
    .hero-sub { font-size: 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <div class="hero">
    <div class="hero-title">🛡️ This Week, DevPulse Protected You</div>
    <div class="hero-sub">${new Date().toLocaleDateString()}</div>
  </div>
  <div class="card">
    <div class="value">$${summary.moneySaved.toFixed(2)}</div>
    <div class="label">Hidden AI costs detected & prevented</div>
  </div>
  <div class="card">
    <div class="value">${summary.agentsStopped}</div>
    <div class="label">Rogue agents stopped</div>
  </div>
  <div class="card">
    <div class="value">${summary.secretsFound}</div>
    <div class="label">Exposed secrets found</div>
  </div>
  <div class="card">
    <div class="value">${summary.threatsBlocked}</div>
    <div class="label">Threats blocked</div>
  </div>
</body>
</html>`;
  }
}
