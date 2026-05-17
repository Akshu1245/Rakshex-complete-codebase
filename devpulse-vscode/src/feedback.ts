import * as vscode from "vscode";
import type { DevPulseApi } from "./api";

export class FeedbackCommand {
  constructor(private readonly api: DevPulseApi) {}

  async execute(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "devpulse.feedback",
      "Send Feedback to DevPulse",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    panel.webview.html = this.getHtml();

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "submit") {
        try {
          await this.api.recordActivity("feedback", {
            category: msg.category,
            message: msg.message,
            email: msg.email || undefined,
            timestamp: new Date().toISOString(),
          });
          void vscode.window.showInformationMessage("DevPulse: Thank you for your feedback!");
          panel.dispose();
        } catch {
          void vscode.window.showErrorMessage(
            "DevPulse: Could not send feedback. Please try again or email hello@devpulse.in",
          );
        }
      }
    });
  }

  private getHtml(): string {
    const nonce = Math.random().toString(36).slice(2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      max-width: 480px;
      margin: 0 auto;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 { margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 20px; font-size: 13px; }
    label { display: block; margin: 16px 0 6px; font-size: 13px; font-weight: 500; }
    select, textarea, input {
      width: 100%;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, #ccc);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 13px;
      box-sizing: border-box;
    }
    textarea { min-height: 100px; resize: vertical; }
    button {
      margin-top: 20px;
      padding: 10px 20px;
      border-radius: 6px;
      border: none;
      background: #2563EB;
      color: white;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #1D4ED8; }
    .privacy { margin-top: 16px; font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <h2>Send Feedback</h2>
  <div class="subtitle">Help us make DevPulse better. We read every message.</div>

  <label for="category">What kind of feedback?</label>
  <select id="category">
    <option value="bug">🐛 Bug report</option>
    <option value="feature">✨ Feature request</option>
    <option value="confusion">😕 Something was confusing</option>
    <option value="praise">❤️ Something you loved</option>
    <option value="other">📝 Other</option>
  </select>

  <label for="message">Your feedback</label>
  <textarea id="message" placeholder="Tell us what's on your mind..."></textarea>

  <label for="email">Email (optional, for follow-up)</label>
  <input type="email" id="email" placeholder="you@example.com" />

  <button id="submit">Send Feedback</button>

  <div class="privacy">Your feedback is sent securely. We never share it.</div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('submit').addEventListener('click', () => {
      const category = document.getElementById('category').value;
      const message = document.getElementById('message').value.trim();
      const email = document.getElementById('email').value.trim();
      if (!message) {
        alert('Please enter a message.');
        return;
      }
      vscode.postMessage({ type: 'submit', category, message, email });
      document.getElementById('submit').textContent = 'Sending...';
      document.getElementById('submit').disabled = true;
    });
  </script>
</body>
</html>`;
  }
}
