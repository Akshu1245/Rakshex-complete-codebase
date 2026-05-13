/**
 * DevPulse Welcome / Onboarding View.
 *
 * Shown in the activity bar when the user is not authenticated.
 * Provides:
 *   - Welcome branding
 *   - Feature overview (3-4 key points)
 *   - API key input field
 *   - "Connect" button
 *   - Link to documentation
 *
 * Uses VS Code CSS variables for theme-aware styling.
 */
import * as crypto from "crypto";
import * as vscode from "vscode";

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpulse.welcome";

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onConnect: (apiKey: string) => Promise<void>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(
      msg => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "connect") {
          const apiKey = (msg.apiKey as string)?.trim();
          if (apiKey && apiKey.length >= 8) {
            void this.onConnect(apiKey);
          }
        } else if (msg.type === "authenticate") {
          vscode.commands.executeCommand("devpulse.authenticate");
        } else if (msg.type === "openDocs") {
          vscode.env.openExternal(vscode.Uri.parse("https://github.com/akshaynhcm-droid/Devpulse-#readme"));
        } else if (msg.type === "createAccount") {
          vscode.env.openExternal(vscode.Uri.parse("https://devpulse.in/signup"));
        }
      }
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPulse</title>
  <style>
    :root { color-scheme: var(--vscode-color-scheme, dark); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 16px;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: 13px;
      line-height: 1.5;
    }

    .logo {
      font-size: 28px;
      text-align: center;
      margin-bottom: 4px;
    }
    .brand {
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      color: var(--vscode-editor-foreground);
      margin-bottom: 4px;
    }
    .tagline {
      font-size: 11px;
      text-align: center;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      margin-bottom: 20px;
    }

    .features {
      margin-bottom: 20px;
    }
    .feature {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0;
    }
    .feature + .feature {
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .feature-icon {
      font-size: 16px;
      min-width: 20px;
      text-align: center;
    }
    .feature-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-editor-foreground);
    }
    .feature-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
    }

    .connect-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .connect-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      margin-bottom: 8px;
    }

    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      font-size: 13px;
      font-family: var(--vscode-editor-font-family, monospace);
      outline: none;
      margin-bottom: 8px;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .btn {
      display: block; width: 100%;
      padding: 8px 16px; border-radius: 4px; cursor: pointer;
      font-size: 13px; font-weight: 500; border: none;
      text-align: center;
      transition: opacity 0.15s;
      color: var(--vscode-button-foreground, #ffffff);
      background: var(--vscode-button-background, #0e639c);
      margin-bottom: 8px;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }

    .docs-link {
      display: block;
      text-align: center;
      margin-top: 12px;
      font-size: 11px;
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
    }
    .docs-link:hover { text-decoration: underline; }

    .hint {
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      text-align: center;
      margin-top: 8px;
    }

    .error-feedback {
      padding: 8px 10px;
      border-radius: 4px;
      background: #ef444415;
      border: 1px solid #ef444430;
      color: #ef4444;
      font-size: 12px;
      margin-bottom: 8px;
      display: none;
    }
    .error-feedback.visible { display: block; }
    .error-feedback-icon { margin-right: 4px; }

    .divider {
      display: flex; align-items: center; gap: 8px;
      margin: 12px 0; color: var(--vscode-descriptionForeground, #8b8b8b);
      font-size: 10px;
    }
    .divider::before, .divider::after {
      content: ""; flex: 1; height: 1px;
      background: var(--vscode-panel-border, #3c3c3c);
    }
  </style>
</head>
<body>
  <div class="logo">🛡</div>
  <div class="brand">DevPulse</div>
  <div class="tagline">Security &amp; cost monitoring for AI agents</div>

  <div class="features">
    <div class="feature">
      <div class="feature-icon">🔍</div>
      <div>
        <div class="feature-title">Security Scanning</div>
        <div class="feature-desc">Detect vulnerabilities in your API collections with automated scans.</div>
      </div>
    </div>
    <div class="feature">
      <div class="feature-icon">💰</div>
      <div>
        <div class="feature-title">Cost Monitoring</div>
        <div class="feature-desc">Track LLM token spend and optimize costs in real-time.</div>
      </div>
    </div>
    <div class="feature">
      <div class="feature-icon">🤖</div>
      <div>
        <div class="feature-title">AI Security Copilot</div>
        <div class="feature-desc">Get fix suggestions and security reviews powered by AI.</div>
      </div>
    </div>
    <div class="feature">
      <div class="feature-icon">🔒</div>
      <div>
        <div class="feature-title">Gateway Protection</div>
        <div class="feature-desc">Inline LLM gateway with PII redaction, injection detection, and rate limiting.</div>
      </div>
    </div>
  </div>

  <div class="connect-section">
    <div class="connect-label">Get Started</div>
    <div class="error-feedback" id="error-feedback">
      <span class="error-feedback-icon">\u26A0</span>
      <span id="error-feedback-msg"></span>
    </div>
    <input type="password" id="api-key-input" placeholder="Paste your API key (dp_...)" />
    <button class="btn" id="connect-btn">Connect</button>
    <div class="divider">or</div>
    <button class="btn btn-secondary" id="auth-btn">Sign in with API Key</button>
    <button class="btn btn-secondary" id="create-account-btn">Create Account</button>
    <div class="hint">Generate an API key from Settings \u2192 API Keys on your DevPulse dashboard.</div>
    <a class="docs-link" href="#" id="docs-link">\u{1F4D6} Documentation</a>
  </div>

  <script nonce="${nonce}">
    (function () {
      var vscode = acquireVsCodeApi();
      var connectBtn = document.getElementById("connect-btn");
      var authBtn = document.getElementById("auth-btn");
      var createAccountBtn = document.getElementById("create-account-btn");
      var apiKeyInput = document.getElementById("api-key-input");
      var docsLink = document.getElementById("docs-link");
      var errorFeedback = document.getElementById("error-feedback");
      var errorFeedbackMsg = document.getElementById("error-feedback-msg");

      function showError(msg) {
        if (errorFeedback && errorFeedbackMsg) {
          errorFeedbackMsg.textContent = msg;
          errorFeedback.classList.add("visible");
        }
        if (apiKeyInput) apiKeyInput.style.borderColor = "#ef4444";
      }

      function hideError() {
        if (errorFeedback) errorFeedback.classList.remove("visible");
        if (apiKeyInput) apiKeyInput.style.borderColor = "";
      }

      if (connectBtn) {
        connectBtn.addEventListener("click", function () {
          var key = apiKeyInput ? apiKeyInput.value.trim() : "";
          hideError();
          if (!key) {
            showError("Please enter an API key.");
            return;
          }
          if (key.length < 8) {
            showError("API key must be at least 8 characters.");
            return;
          }
          if (!key.startsWith("dp_")) {
            showError("API key should start with \"dp_\". Check that you copied the full key.");
            return;
          }
          connectBtn.disabled = true;
          connectBtn.textContent = "Connecting\u2026";
          vscode.postMessage({ type: "connect", apiKey: key });
        });
      }

      if (authBtn) {
        authBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "authenticate" });
        });
      }

      if (createAccountBtn) {
        createAccountBtn.addEventListener("click", function () {
          vscode.postMessage({ type: "createAccount" });
        });
      }

      if (apiKeyInput) {
        apiKeyInput.addEventListener("input", function () {
          hideError();
        });
        apiKeyInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            connectBtn.click();
          }
        });
      }

      // Handle connection error feedback from extension
      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (msg && msg.type === "connectError") {
          showError(msg.message || "Connection failed. Please check your API key.");
          if (connectBtn) {
            connectBtn.disabled = false;
            connectBtn.textContent = "Connect";
          }
        }
      });

      if (docsLink) {
        docsLink.addEventListener("click", function (e) {
          e.preventDefault();
          vscode.postMessage({ type: "openDocs" });
        });
      }
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
