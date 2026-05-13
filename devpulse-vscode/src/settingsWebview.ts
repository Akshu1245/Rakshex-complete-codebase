/**
 * DevPulse Settings Webview Panel.
 *
 * A self-contained VS Code WebviewPanel that allows users to:
 *   - Configure API URL and Gateway URL
 *   - Toggle heartbeat tracking and set interval
 *   - Toggle file change tracking
 *   - Generate new API key
 *   - View current plan and usage
 *
 * Uses VS Code CSS variables for theme-aware styling.
 */
import * as crypto from "crypto";
import * as vscode from "vscode";
import type { DevPulseApi, DashboardData, ValidatedUser } from "./api";

export class SettingsWebviewPanel {
  private static current: SettingsWebviewPanel | undefined;
  public static readonly viewType = "devpulse.settings";

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly api: DevPulseApi,
    private readonly readApiKey: () => string | undefined,
    private readonly extensionContext: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      msg => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "updateSetting") {
          void this.handleUpdateSetting(msg.key as string, msg.value as unknown);
        } else if (msg.type === "generateApiKey") {
          void this.handleGenerateApiKey();
        } else if (msg.type === "signIn") {
          vscode.commands.executeCommand("devpulse.authenticate");
        } else if (msg.type === "testConnection") {
          void this.handleTestConnection(msg.url as string);
        } else if (msg.type === "refresh") {
          void this.refresh();
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    api: DevPulseApi,
    readApiKey: () => string | undefined,
    context: vscode.ExtensionContext
  ): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (SettingsWebviewPanel.current) {
      SettingsWebviewPanel.current.panel.reveal(column);
      void SettingsWebviewPanel.current.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SettingsWebviewPanel.viewType,
      "DevPulse Settings",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    SettingsWebviewPanel.current = new SettingsWebviewPanel(panel, api, readApiKey, context);
    void SettingsWebviewPanel.current.refresh();
  }

  private async handleUpdateSetting(key: string, value: unknown): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("devpulse");
    const target = vscode.ConfigurationTarget.Global;
    try {
      if (typeof value === "boolean") {
        await cfg.update(key, value, target);
      } else if (typeof value === "number") {
        await cfg.update(key, value, target);
      } else if (typeof value === "string") {
        await cfg.update(key, value, target);
      }
      vscode.window.showInformationMessage(`DevPulse: setting "${key}" updated.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevPulse: could not update setting — ${msg}`);
    }
  }

  private async handleGenerateApiKey(): Promise<void> {
    const key = this.readApiKey();
    if (!key) {
      vscode.window.showWarningMessage("DevPulse: sign in first to generate an API key.");
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      "Generate a new API key? Your current key will be invalidated.",
      { modal: true },
      "Generate"
    );
    if (confirm !== "Generate") return;
    try {
      const result = await this.api.generateApiKey();
      await vscode.env.clipboard.writeText(result.apiKey);
      await this.extensionContext.secrets.store("devpulse.apiKey", result.apiKey);
      vscode.window.showInformationMessage(
        `New API key generated and copied to clipboard.`
      );
      void this.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevPulse: could not generate API key — ${msg}`);
    }
  }

  private async handleTestConnection(url: string): Promise<void> {
    const baseUrl = (url || this.api["getBaseUrl"]()).replace(/\/+$/, "");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        this.panel.webview.postMessage({ type: "testConnectionResult", status: "success", message: `Connected successfully (${res.status})` });
      } else {
        this.panel.webview.postMessage({ type: "testConnectionResult", status: "error", message: `Server responded with ${res.status} ${res.statusText}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        this.panel.webview.postMessage({ type: "testConnectionResult", status: "error", message: "Connection timed out after 10 seconds" });
      } else {
        this.panel.webview.postMessage({ type: "testConnectionResult", status: "error", message: `Could not connect: ${msg}` });
      }
    }
  }

  private async refresh(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("devpulse");
    const settings = {
      apiUrl: cfg.get<string>("apiUrl", "https://api.devpulse.in"),
      gatewayUrl: cfg.get<string>("gatewayUrl", "http://localhost:8081"),
      heartbeatIntervalSec: cfg.get<number>("heartbeatIntervalSec", 120),
      trackFileChanges: cfg.get<boolean>("trackFileChanges", true),
    };

    let user: ValidatedUser | null = null;
    let dashboard: DashboardData | null = null;
    const apiKey = this.readApiKey();

    if (apiKey) {
      try {
        const result = await this.api.validateApiKey(apiKey);
        user = result.user;
      } catch {
        /* ignore */
      }
      try {
        dashboard = await this.api.getDashboardData();
      } catch {
        /* ignore */
      }
    }

    this.panel.webview.html = this._getHtmlForWebview(
      this.panel.webview,
      { settings, user, dashboard, signedIn: Boolean(apiKey) }
    );
  }

  public dispose(): void {
    SettingsWebviewPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    state: {
      settings: {
        apiUrl: string;
        gatewayUrl: string;
        heartbeatIntervalSec: number;
        trackFileChanges: boolean;
      };
      user: ValidatedUser | null;
      dashboard: DashboardData | null;
      signedIn: boolean;
    }
  ): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join("; ");

    const { settings, user, dashboard, signedIn } = state;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPulse Settings</title>
  <style>
    :root { color-scheme: var(--vscode-color-scheme, dark); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 24px;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: 13px;
      line-height: 1.5;
    }
    h1 { font-size: 20px; font-weight: 600; color: var(--vscode-editor-foreground); margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 600; color: var(--vscode-editor-foreground); margin: 24px 0 12px; }
    .sub { color: var(--vscode-descriptionForeground, #8b8b8b); font-size: 12px; margin-bottom: 20px; }

    .section {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 13px; font-weight: 600;
      color: var(--vscode-editor-foreground);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .field { margin-bottom: 14px; }
    .field:last-child { margin-bottom: 0; }
    .field-label {
      display: block;
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      margin-bottom: 4px;
    }
    .field-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      margin-top: 2px;
    }

    input[type="text"],
    input[type="number"] {
      width: 100%;
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      font-size: 13px;
      font-family: var(--vscode-editor-font-family, monospace);
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }
    .toggle-row + .toggle-row {
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .toggle-label {
      font-size: 13px;
      color: var(--vscode-editor-foreground);
    }
    .toggle-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
    }

    /* Toggle switch */
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      cursor: pointer;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; inset: 0;
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 10px;
      transition: background 0.2s;
    }
    .toggle-slider::before {
      content: "";
      position: absolute;
      width: 14px; height: 14px;
      left: 2px; top: 2px;
      background: var(--vscode-editor-foreground, #cccccc);
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle-switch input:checked + .toggle-slider {
      background: var(--vscode-button-background, #0e639c);
      border-color: var(--vscode-button-background, #0e639c);
    }
    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 4px; cursor: pointer;
      font-size: 13px; font-weight: 500; border: none;
      transition: opacity 0.15s;
      color: var(--vscode-button-foreground, #ffffff);
      background: var(--vscode-button-background, #0e639c);
    }
    .btn:hover { opacity: 0.9; }
    .btn-danger {
      background: #ef4444;
      color: #fff;
    }
    .btn-danger:hover { background: #dc2626; }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }

    .plan-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px;
      border-radius: 6px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .plan-icon { font-size: 24px; }
    .plan-name { font-weight: 600; font-size: 14px; }
    .plan-email { font-size: 12px; color: var(--vscode-descriptionForeground, #8b8b8b); }
    .usage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .usage-item {
      padding: 10px;
      border-radius: 4px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .usage-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vscode-descriptionForeground, #8b8b8b); }
    .usage-value { font-size: 18px; font-weight: 600; color: var(--vscode-editor-foreground); }

    .sign-in-notice {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
    }
    .sign-in-notice a {
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
    }
    .sign-in-notice a:hover { text-decoration: underline; }

    /* Test Connection */
    .test-connection-row {
      display: flex; align-items: center; gap: 8px;
      margin-top: 6px;
    }
    .btn-test {
      padding: 5px 12px; border-radius: 4px; cursor: pointer;
      font-size: 12px; font-weight: 500; border: 1px solid var(--vscode-panel-border, #3c3c3c);
      background: transparent; color: var(--vscode-descriptionForeground, #8b8b8b);
      transition: all 0.15s;
    }
    .btn-test:hover { border-color: var(--vscode-focusBorder, #007fd4); color: var(--vscode-editor-foreground); }
    .btn-test:disabled { opacity: 0.4; cursor: not-allowed; }
    .connection-result {
      font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;
      opacity: 0; transition: opacity 0.2s;
    }
    .connection-result.visible { opacity: 1; }
    .connection-result.success { color: #22c55e; }
    .connection-result.error { color: #ef4444; }
    .connection-result-dot {
      width: 6px; height: 6px; border-radius: 50%; display: inline-block;
    }
    .connection-result.success .connection-result-dot { background: #22c55e; }
    .connection-result.error .connection-result-dot { background: #ef4444; }
  </style>
</head>
<body>
  <h1>⚙ DevPulse Settings</h1>
  <p class="sub">Configure your DevPulse extension preferences.</p>

  ${!signedIn ? `
    <div class="sign-in-notice">
      <p>Sign in to access all settings and view your plan details.</p>
      <p><a href="#" id="sign-in-link">Sign in with API Key</a></p>
    </div>
  ` : ""}

  <!-- Connection Settings -->
  <div class="section">
    <div class="section-title">🔗 Connection</div>
    <div class="field">
      <label class="field-label" for="apiUrl">API URL</label>
      <input type="text" id="apiUrl" value="${escapeHtml(settings.apiUrl)}" />
      <div class="field-hint">Base URL of the DevPulse backend.</div>
      <div class="test-connection-row">
        <button class="btn-test" id="test-connection-btn">\u26A1 Test Connection</button>
        <span class="connection-result" id="connection-result">
          <span class="connection-result-dot"></span>
          <span id="connection-result-msg"></span>
        </span>
      </div>
    </div>
    <div class="field">
      <label class="field-label" for="gatewayUrl">Gateway URL</label>
      <input type="text" id="gatewayUrl" value="${escapeHtml(settings.gatewayUrl)}" />
      <div class="field-hint">Base URL of the DevPulse inline LLM gateway.</div>
    </div>
  </div>

  <!-- Activity Tracking -->
  <div class="section">
    <div class="section-title">📡 Activity Tracking</div>
    <div class="toggle-row">
      <div>
        <div class="toggle-label">Heartbeat Tracking</div>
        <div class="toggle-hint">Send periodic activity pings to the backend</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="heartbeatEnabled" ${settings.heartbeatIntervalSec > 0 ? "checked" : ""} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="field" style="margin-top: 10px;">
      <label class="field-label" for="heartbeatInterval">Heartbeat Interval (seconds)</label>
      <input type="number" id="heartbeatInterval" value="${settings.heartbeatIntervalSec}" min="30" max="600" step="10" />
      <div class="field-hint">Minimum 30 seconds. Set to 0 to disable.</div>
    </div>
    <div class="toggle-row">
      <div>
        <div class="toggle-label">File Change Tracking</div>
        <div class="toggle-hint">Track file saves (never sends file contents)</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="trackFileChanges" ${settings.trackFileChanges ? "checked" : ""} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>

  <!-- API Key -->
  <div class="section">
    <div class="section-title">🔑 API Key</div>
    ${signedIn ? `
      <p style="margin-bottom: 12px; color: var(--vscode-descriptionForeground, #8b8b8b);">
        Your API key is stored securely in VS Code's SecretStorage.
      </p>
      <button class="btn btn-danger" id="generate-key-btn">🔄 Generate New API Key</button>
      <div class="field-hint" style="margin-top: 6px;">This will invalidate your current key.</div>
    ` : `
      <p style="color: var(--vscode-descriptionForeground, #8b8b8b);">
        Sign in to manage your API key.
      </p>
    `}
  </div>

  <!-- Plan & Usage -->
  <div class="section">
    <div class="section-title">📊 Plan & Usage</div>
    ${signedIn && user ? `
      <div class="plan-card">
        <div class="plan-icon">👤</div>
        <div>
          <div class="plan-name">${escapeHtml(user.plan)} Plan</div>
          <div class="plan-email">${escapeHtml(user.email ?? user.name ?? "User")}</div>
        </div>
      </div>
      ${dashboard ? `
        <div class="usage-grid">
          <div class="usage-item">
            <div class="usage-label">Collections</div>
            <div class="usage-value">${dashboard.collections}</div>
          </div>
          <div class="usage-item">
            <div class="usage-label">Open Findings</div>
            <div class="usage-value">${dashboard.openFindings}</div>
          </div>
          <div class="usage-item">
            <div class="usage-label">Recent Scans</div>
            <div class="usage-value">${dashboard.recentScans}</div>
          </div>
          <div class="usage-item">
            <div class="usage-label">Weekly Cost</div>
            <div class="usage-value">$${dashboard.weeklyCost.toFixed(2)}</div>
          </div>
        </div>
      ` : ""}
    ` : `
      <p style="color: var(--vscode-descriptionForeground, #8b8b8b);">
        Sign in to view your plan and usage details.
      </p>
    `}
  </div>

  <script nonce="${nonce}">
    (function () {
      var vscode = acquireVsCodeApi();

      function updateSetting(key, value) {
        vscode.postMessage({ type: "updateSetting", key: key, value: value });
      }

      // API URL
      var apiUrlInput = document.getElementById("apiUrl");
      if (apiUrlInput) {
        apiUrlInput.addEventListener("change", function () {
          updateSetting("apiUrl", this.value);
        });
      }

      // Gateway URL
      var gatewayUrlInput = document.getElementById("gatewayUrl");
      if (gatewayUrlInput) {
        gatewayUrlInput.addEventListener("change", function () {
          updateSetting("gatewayUrl", this.value);
        });
      }

      // Heartbeat toggle
      var heartbeatEnabled = document.getElementById("heartbeatEnabled");
      var heartbeatInterval = document.getElementById("heartbeatInterval");
      if (heartbeatEnabled) {
        heartbeatEnabled.addEventListener("change", function () {
          if (heartbeatInterval) {
            var val = this.checked ? parseInt(heartbeatInterval.value, 10) || 120 : 0;
            updateSetting("heartbeatIntervalSec", val);
          }
        });
      }
      if (heartbeatInterval) {
        heartbeatInterval.addEventListener("change", function () {
          var val = parseInt(this.value, 10);
          if (val < 30 && val !== 0) val = 30;
          if (val > 600) val = 600;
          updateSetting("heartbeatIntervalSec", val);
        });
      }

      // File change tracking toggle
      var trackFileChanges = document.getElementById("trackFileChanges");
      if (trackFileChanges) {
        trackFileChanges.addEventListener("change", function () {
          updateSetting("trackFileChanges", this.checked);
        });
      }

      // Generate API key
      var generateKeyBtn = document.getElementById("generate-key-btn");
      if (generateKeyBtn) {
        generateKeyBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "generateApiKey" });
        });
      }

      // Sign in link
      var signInLink = document.getElementById("sign-in-link");
      if (signInLink) {
        signInLink.addEventListener("click", function (e) {
          e.preventDefault();
          vscode.postMessage({ type: "signIn" });
        });
      }

      // Test Connection
      var testConnBtn = document.getElementById("test-connection-btn");
      var connResult = document.getElementById("connection-result");
      var connResultMsg = document.getElementById("connection-result-msg");
      if (testConnBtn) {
        testConnBtn.addEventListener("click", function () {
          var url = apiUrlInput ? apiUrlInput.value.trim() : "";
          if (!url) {
            if (connResult && connResultMsg) {
              connResult.className = "connection-result visible error";
              connResultMsg.textContent = "Enter an API URL first";
            }
            return;
          }
          testConnBtn.disabled = true;
          testConnBtn.textContent = "Testing…";
          if (connResult) { connResult.className = "connection-result"; }
          vscode.postMessage({ type: "testConnection", url: url });
        });
      }

      // Handle test connection result
      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (msg && msg.type === "testConnectionResult") {
          if (testConnBtn) {
            testConnBtn.disabled = false;
            testConnBtn.textContent = "\u26A1 Test Connection";
          }
          if (connResult && connResultMsg) {
            connResult.className = "connection-result visible " + msg.status;
            connResultMsg.textContent = msg.message || (msg.status === "success" ? "Connected" : "Failed");
          }
        }
      });
    }());
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
