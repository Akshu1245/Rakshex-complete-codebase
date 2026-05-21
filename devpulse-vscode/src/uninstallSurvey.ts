import * as vscode from "vscode";
import type { RakshexApi } from "./api";

export class UninstallSurvey {
  constructor(private readonly api: RakshexApi) {}

  async show(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "rakshex.uninstallSurvey",
      "Help us improve Rakshex",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    panel.webview.html = this.getHtml();

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "submit") {
        try {
          await this.api.recordActivity("uninstall_feedback", {
            reason: msg.reason,
            detail: msg.detail || undefined,
            wouldReturn: msg.wouldReturn,
            timestamp: new Date().toISOString(),
          });
          void vscode.window.showInformationMessage("Thank you for helping us improve Rakshex.");
          panel.dispose();
        } catch {
          panel.dispose();
        }
      } else if (msg.type === "cancel") {
        panel.dispose();
      }
    });
  }

  private getHtml(): string {
    const nonce = Math.random().toString(36).slice(2);
    const reasons = [
      { id: "confusing", label: "It was confusing or hard to use" },
      { id: "no_value", label: "I didn't find any security issues" },
      { id: "slow", label: "It was slow or buggy" },
      { id: "alternative", label: "I'm using a different tool" },
      { id: "not_needed", label: "I don't need AI security scanning" },
      { id: "other", label: "Something else" },
    ];

    const reasonHtml = reasons
      .map(
        (r) => `
        <label class="reason-option">
          <input type="radio" name="reason" value="${r.id}" />
          <span class="reason-label">${r.label}</span>
        </label>`,
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px 24px;
      max-width: 440px;
      margin: 0 auto;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 { font-size: 18px; margin-bottom: 6px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 24px; }
    .reason-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--vscode-panel-border, #333);
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .reason-option:hover {
      border-color: #6366f1;
      background: rgba(99,102,241,0.05);
    }
    .reason-option input { margin-top: 3px; }
    .reason-label { font-size: 13px; }
    textarea {
      width: 100%;
      min-height: 80px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 13px;
      margin-top: 16px;
      resize: vertical;
      box-sizing: border-box;
    }
    .return-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      font-size: 13px;
    }
    .btn-row {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    .btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary {
      background: #2563EB;
      color: white;
    }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #333);
      color: var(--vscode-button-secondaryForeground);
    }
    .thank-you { display: none; text-align: center; padding: 40px 20px; }
    .thank-you h3 { margin-bottom: 8px; }
    .thank-you p { color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div id="form">
    <h2>Sorry to see you go</h2>
    <div class="subtitle">Your feedback helps us improve Rakshex for developers like you.</div>

    <div style="font-size: 12px; font-weight: 600; margin-bottom: 10px; color: #888;">Why are you uninstalling?</div>
    ${reasonHtml}

    <textarea id="detail" placeholder="Anything else you'd like us to know? (optional)"></textarea>

    <div class="return-row">
      <input type="checkbox" id="wouldReturn" />
      <label for="wouldReturn">I'd try Rakshex again if you fixed my issue</label>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" id="cancel">Skip</button>
      <button class="btn btn-primary" id="submit">Send Feedback</button>
    </div>
  </div>

  <div class="thank-you" id="thank-you">
    <h3>Thank you 🙏</h3>
    <p>We read every piece of feedback. If you change your mind, Rakshex will be right here.</p>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const submitBtn = document.getElementById('submit');
    const cancelBtn = document.getElementById('cancel');

    function getSelectedReason() {
      const checked = document.querySelector('input[name="reason"]:checked');
      return checked ? checked.value : null;
    }

    submitBtn.addEventListener('click', () => {
      const reason = getSelectedReason();
      if (!reason) {
        alert('Please select a reason.');
        return;
      }
      const detail = document.getElementById('detail').value.trim();
      const wouldReturn = document.getElementById('wouldReturn').checked;
      vscode.postMessage({ type: 'submit', reason, detail, wouldReturn });
      document.getElementById('form').style.display = 'none';
      document.getElementById('thank-you').style.display = 'block';
    });

    cancelBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'cancel' });
    });
  </script>
</body>
</html>`;
  }
}
