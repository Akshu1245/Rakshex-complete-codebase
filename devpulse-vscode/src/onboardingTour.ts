import * as vscode from "vscode";
import type { DevPulseApi, Collection } from "./api";
import type { EngagementTracker } from "./engagementTracker";

export class OnboardingTour {
  private panel?: vscode.WebviewPanel;
  private dismissCallbacks: Array<() => void> = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly api: DevPulseApi,
    private readonly engagementTracker: EngagementTracker,
    private readonly onComplete: () => void,
  ) {}

  onDismiss(callback: () => void): void {
    this.dismissCallbacks.push(callback);
  }

  async start(): Promise<void> {
    const progress = this.engagementTracker.getOnboardingProgress();
    const completed = progress.filter((p) => p.complete).length;
    if (completed >= 4) return; // already onboarded

    this.panel = vscode.window.createWebviewPanel(
      "devpulse.onboardingTour",
      "Welcome to DevPulse",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    this.panel.onDidDispose(() => {
      this.dismissCallbacks.forEach((cb) => cb());
    });

    this.panel.webview.html = this.getHtml(completed);

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "step_complete") {
        const step = msg.step as string;
        this.engagementTracker.recordOnboardingStep(step as any);

        if (step === "connect") {
          await vscode.commands.executeCommand("devpulse.authenticate");
        } else if (step === "import") {
          await vscode.commands.executeCommand("devpulse.importCollections");
        } else if (step === "scan") {
          await this.runFirstScan();
        } else if (step === "review") {
          await vscode.commands.executeCommand("devpulse.openSecurityPanel");
        }

        const updated = this.engagementTracker.getOnboardingProgress();
        const done = updated.filter((p) => p.complete).length;
        if (done >= 4) {
          this.panel?.dispose();
          this.onComplete();
        } else {
          this.panel!.webview.html = this.getHtml(done);
        }
      }
    });
  }

  private async runFirstScan(): Promise<void> {
    try {
      const collections = await this.api.listCollections();
      if (collections.length === 0) {
        void vscode.window.showInformationMessage(
          "Import a collection first, then come back to scan.",
        );
        return;
      }
      const picked = await vscode.window.showQuickPick(
        collections.map((c) => ({ label: c.name, collectionId: c.id })),
        { title: "Pick a collection to scan" },
      );
      if (!picked) return;
      const scan = await this.api.triggerScan(picked.collectionId);
      void vscode.window.showInformationMessage(
        `Scan queued (id ${scan.scanId}). Results will appear in the DevPulse panel.`,
      );
      this.engagementTracker.record("scan_run");
      this.engagementTracker.recordOnboardingStep("scanned");
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private getHtml(completedSteps: number): string {
    const steps = [
      {
        id: "connect",
        label: "Connect your API key",
        icon: "🔑",
        desc: "Link DevPulse to your account",
      },
      { id: "import", label: "Import a collection", icon: "📁", desc: "Add your API definitions" },
      {
        id: "scan",
        label: "Run your first scan",
        icon: "🔍",
        desc: "Find security issues in seconds",
      },
      {
        id: "review",
        label: "Review your findings",
        icon: "🛡️",
        desc: "See what DevPulse discovered",
      },
    ];

    const nonce = Math.random().toString(36).slice(2);
    const stepHtml = steps
      .map((s, i) => {
        const done = i < completedSteps;
        const active = i === completedSteps;
        const statusClass = done ? "done" : active ? "active" : "pending";
        return `
        <div class="step ${statusClass}" data-step="${s.id}">
          <div class="step-icon">${done ? "✅" : s.icon}</div>
          <div class="step-content">
            <div class="step-title">${s.label}</div>
            <div class="step-desc">${s.desc}</div>
          </div>
          ${active ? `<button class="step-btn" onclick="completeStep('${s.id}')">${i === 0 ? "Connect" : i === 1 ? "Import" : i === 2 ? "Scan" : "Review"}</button>` : ""}
          ${done ? `<span class="step-done">Done</span>` : ""}
        </div>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px 32px;
      max-width: 520px;
      margin: 0 auto;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .hero { text-align: center; margin-bottom: 32px; }
    .hero h1 { font-size: 22px; margin-bottom: 8px; }
    .hero p { color: #888; font-size: 14px; margin: 0; }
    .progress-bar { height: 4px; background: #333; border-radius: 2px; margin-bottom: 24px; overflow: hidden; }
    .progress-fill { height: 100%; background: #2563EB; border-radius: 2px; width: ${(completedSteps / steps.length) * 100}%; transition: width 0.3s; }
    .step { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--vscode-panel-border, #333); }
    .step.done { opacity: 0.6; border-color: #16A34A; }
    .step.active { border-color: #2563EB; background: rgba(37,99,235,0.05); }
    .step-icon { font-size: 24px; width: 36px; text-align: center; }
    .step-content { flex: 1; }
    .step-title { font-weight: 600; font-size: 15px; }
    .step-desc { font-size: 13px; color: #888; margin-top: 2px; }
    .step-btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background: #2563EB;
      color: white;
      font-size: 13px;
      cursor: pointer;
    }
    .step-btn:hover { background: #1D4ED8; }
    .step-done { color: #16A34A; font-size: 13px; font-weight: 500; }
    .tip { margin-top: 24px; padding: 12px 16px; background: rgba(37,99,235,0.08); border-radius: 6px; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>Welcome to DevPulse</h1>
    <p>Secure your AI agents and APIs in 4 simple steps</p>
  </div>
  <div class="progress-bar"><div class="progress-fill"></div></div>
  ${stepHtml}
  <div class="tip">💡 Tip: DevPulse scans your API collections for security issues, hidden costs, and compliance risks — all without uploading your source code.</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function completeStep(step) {
      document.querySelectorAll('.step-btn').forEach(b => { b.disabled = true; b.textContent = 'Loading...'; });
      vscode.postMessage({ type: 'step_complete', step });
    }
  </script>
</body>
</html>`;
  }
}
