/**
 * Rakshex Welcome / Onboarding View.
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
  public static readonly viewType = "rakshex.welcome";

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onConnect: (apiKey: string) => Promise<void>,
    private readonly onQuickAction?: (action: string) => void,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "connect") {
        const apiKey = (msg.apiKey as string)?.trim();
        if (apiKey && apiKey.length >= 8) {
          void this.onConnect(apiKey);
        }
      } else if (msg.type === "authenticate") {
        vscode.commands.executeCommand("rakshex.authenticate");
      } else if (msg.type === "openDocs") {
        vscode.env.openExternal(vscode.Uri.parse("https://rakshex.in"));
      } else if (msg.type === "createAccount") {
        vscode.env.openExternal(vscode.Uri.parse("https://rakshex.in/signup"));
      } else if (msg.type === "quickAction" && this.onQuickAction) {
        this.onQuickAction(msg.action as string);
      }
    });
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
  <title>Rakshex</title>
  <style>
    :root { color-scheme: var(--vscode-color-scheme, dark); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 20px 16px;
      background: var(--vscode-editor-background, #0d1117);
      color: var(--vscode-editor-foreground, #c9d1d9);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: 13px;
      line-height: 1.5;
      overflow-x: hidden;
    }

    /* Hero / Brand */
    .hero {
      text-align: center;
      margin-bottom: 24px;
      position: relative;
    }
    .logo-ring {
      width: 56px; height: 56px;
      margin: 0 auto 12px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 20px rgba(99,102,241,0.3);
      animation: pulse-glow 3s ease-in-out infinite;
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 4px 20px rgba(99,102,241,0.3); transform: scale(1); }
      50% { box-shadow: 0 4px 30px rgba(99,102,241,0.5); transform: scale(1.02); }
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #818cf8, #c084fc, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 4px;
    }
    .tagline {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #8b949e);
      font-weight: 500;
    }

    /* Trust badges */
    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .trust-badge {
      display: flex; align-items: center; gap: 4px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #8b949e);
      background: var(--vscode-button-secondaryBackground, #21262d);
      padding: 3px 8px;
      border-radius: 12px;
      border: 1px solid var(--vscode-panel-border, #30363d);
    }
    .trust-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #22c55e;
      animation: blink 2s infinite;
    }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Stats strip (dopamine counters) */
    .stats-strip {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .stat-card {
      flex: 1;
      background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02));
      border: 1px solid rgba(34,197,94,0.15);
      border-radius: 10px;
      padding: 10px;
      text-align: center;
      transition: transform 0.2s, border-color 0.2s;
    }
    .stat-card:hover { transform: translateY(-1px); border-color: rgba(34,197,94,0.3); }
    .stat-value {
      font-size: 18px;
      font-weight: 800;
      color: #22c55e;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 9px;
      color: var(--vscode-descriptionForeground, #8b949e);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .stat-card.cost {
      background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02));
      border-color: rgba(245,158,11,0.15);
    }
    .stat-card.cost:hover { border-color: rgba(245,158,11,0.3); }
    .stat-card.cost .stat-value { color: #f59e0b; }
    .stat-card.risk {
      background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02));
      border-color: rgba(239,68,68,0.15);
    }
    .stat-card.risk:hover { border-color: rgba(239,68,68,0.3); }
    .stat-card.risk .stat-value { color: #ef4444; }

    /* Features */
    .features {
      margin-bottom: 20px;
    }
    .feature {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 6px;
      background: var(--vscode-button-secondaryBackground, #21262d);
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s;
      cursor: default;
    }
    .feature:hover {
      border-color: var(--vscode-panel-border, #30363d);
      background: var(--vscode-list-hoverBackground, #1c2128);
    }
    .feature-icon {
      width: 28px; height: 28px;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
      flex-shrink: 0;
    }
    .feature-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-editor-foreground, #c9d1d9);
    }
    .feature-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b949e);
    }

    /* Onboarding progress */
    .onboarding-progress {
      margin-bottom: 20px;
    }
    .onboarding-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--vscode-editor-foreground, #c9d1d9);
      margin-bottom: 10px;
      display: flex; align-items: center; gap: 6px;
    }
    .onboarding-title::before {
      content: "";
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #6366f1;
      animation: blink 2s infinite;
    }
    .progress-track {
      height: 4px;
      background: var(--vscode-panel-border, #30363d);
      border-radius: 2px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 2px;
      transition: width 0.6s ease;
    }
    .step {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 0;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b949e);
    }
    .step-num {
      width: 18px; height: 18px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px;
      font-weight: 700;
      background: var(--vscode-panel-border, #30363d);
      color: var(--vscode-descriptionForeground, #8b949e);
      flex-shrink: 0;
    }
    .step.active .step-num {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
    .step.active {
      color: var(--vscode-editor-foreground, #c9d1d9);
      font-weight: 600;
    }
    .step.done .step-num {
      background: #22c55e;
      color: white;
    }
    .step.done { color: var(--vscode-descriptionForeground, #8b949e); text-decoration: line-through; }

    /* Connect section */
    .connect-section {
      background: linear-gradient(180deg, rgba(99,102,241,0.04), transparent);
      border: 1px solid var(--vscode-panel-border, #30363d);
      border-radius: 12px;
      padding: 16px;
      margin-top: 8px;
    }
    .connect-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--vscode-editor-foreground, #c9d1d9);
      margin-bottom: 10px;
      display: flex; align-items: center; gap: 6px;
    }
    .connect-label::before {
      content: "🔑";
      font-size: 12px;
    }

    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--vscode-input-border, #30363d);
      background: var(--vscode-input-background, #21262d);
      color: var(--vscode-input-foreground, #c9d1d9);
      font-size: 13px;
      font-family: var(--vscode-editor-font-family, monospace);
      outline: none;
      margin-bottom: 10px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
    }
    input::placeholder {
      color: var(--vscode-input-placeholderForeground, #6e7681);
    }

    .btn {
      display: block; width: 100%;
      padding: 9px 16px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600; border: none;
      text-align: center;
      transition: all 0.2s;
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      margin-bottom: 8px;
      position: relative;
      overflow: hidden;
    }
    .btn::after {
      content: "";
      position: absolute;
      top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      transition: left 0.5s;
    }
    .btn:hover::after { left: 100%; }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    }
    .btn:active { transform: translateY(0); }
    .btn:disabled {
      opacity: 0.5; cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #21262d);
      color: var(--vscode-button-secondaryForeground, #c9d1d9);
      border: 1px solid var(--vscode-panel-border, #30363d);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-hoverBackground, #30363d);
      box-shadow: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      font-size: 14px;
      padding: 12px 20px;
      animation: pulse-glow 3s ease-in-out infinite;
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(37,99,235,0.4);
    }

    .cta-section {
      text-align: center;
      margin-bottom: 20px;
    }
    .cta-sub {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #8b949e);
      margin-top: 6px;
      margin-bottom: 8px;
    }
    .btn-link {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground, #58a6ff);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
      padding: 4px;
    }
    .btn-link:hover { color: var(--vscode-textLink-activeForeground, #79c0ff); }

    .social-proof {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      background: linear-gradient(90deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02));
      border: 1px solid rgba(245,158,11,0.15);
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 12px;
      color: #f59e0b;
      font-weight: 500;
    }
    .sparkle { animation: sparkle 2s ease-in-out infinite; }
    @keyframes sparkle {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.2); }
    }

    .divider {
      display: flex; align-items: center; gap: 8px;
      margin: 12px 0; color: var(--vscode-descriptionForeground, #6e7681);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .divider::before, .divider::after {
      content: ""; flex: 1; height: 1px;
      background: var(--vscode-panel-border, #30363d);
    }

    .docs-link {
      display: block;
      text-align: center;
      margin-top: 12px;
      font-size: 11px;
      color: var(--vscode-textLink-foreground, #58a6ff);
      text-decoration: none;
      font-weight: 500;
    }
    .docs-link:hover { text-decoration: underline; }

    .hint {
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #6e7681);
      text-align: center;
      margin-top: 8px;
      line-height: 1.4;
    }

    .error-feedback {
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #f87171;
      font-size: 12px;
      margin-bottom: 10px;
      display: none;
      align-items: center; gap: 6px;
    }
    .error-feedback.visible { display: flex; }

    /* Quick actions */
    .quick-actions {
      margin-top: 16px;
    }
    .quick-actions-title {
      font-size: 10px;
      font-weight: 700;
      color: var(--vscode-descriptionForeground, #6e7681);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .quick-action {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 11px;
      color: var(--vscode-editor-foreground, #c9d1d9);
      cursor: pointer;
      transition: background 0.15s;
      border: 1px solid transparent;
    }
    .quick-action:hover {
      background: var(--vscode-list-hoverBackground, #1c2128);
      border-color: var(--vscode-panel-border, #30363d);
    }
    .quick-action-icon {
      font-size: 12px;
      width: 20px; text-align: center;
    }
    .quick-action-kbd {
      margin-left: auto;
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #6e7681);
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-button-secondaryBackground, #21262d);
      padding: 1px 5px;
      border-radius: 3px;
    }

    /* Loading shimmer */
    .shimmer {
      background: linear-gradient(90deg, var(--vscode-button-secondaryBackground, #21262d) 25%, var(--vscode-list-hoverBackground, #1c2128) 50%, var(--vscode-button-secondaryBackground, #21262d) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="logo-ring">🛡</div>
    <div class="brand">Rakshex</div>
    <div class="tagline">Security &amp; cost intelligence for AI agents</div>
  </div>

  <!-- Social proof banner -->
  <div class="social-proof">
    <span class="sparkle">✨</span>
    <span>First scan in under 60 seconds — no credit card required</span>
  </div>

  <!-- Primary CTA -->
  <div class="cta-section">
    <button class="btn btn-primary" id="create-account-btn">Get Started Free →</button>
    <div class="cta-sub">Takes 30 seconds. Free forever for individuals.</div>
    <button class="btn-link" id="has-key-toggle">Already have an API key?</button>
  </div>

  <!-- API key input (hidden by default) -->
  <div class="connect-section" id="key-section" style="display:none;">
    <div class="error-feedback" id="error-feedback">
      <span>\u26A0</span>
      <span id="error-feedback-msg"></span>
    </div>
    <input type="password" id="api-key-input" placeholder="Paste your API key (dp_...)" />
    <button class="btn" id="connect-btn">Connect to Rakshex</button>
  </div>

  <!-- Trust badges -->
  <div class="trust-badges">
    <div class="trust-badge"><div class="trust-dot"></div>AES-256 Encrypted</div>
    <div class="trust-badge">🔒 Code never uploaded</div>
    <div class="trust-badge">⚡ Real-time scans</div>
  </div>

  <!-- Features -->
  <div class="features">
    <div class="feature">
      <div class="feature-icon">🔍</div>
      <div>
        <div class="feature-title">Find leaked API keys</div>
        <div class="feature-desc">Scan collections & env files for exposed secrets in seconds</div>
      </div>
    </div>
    <div class="feature">
      <div class="feature-icon">💰</div>
      <div>
        <div class="feature-title">Stop runaway AI costs</div>
        <div class="feature-desc">Detect infinite loops & hidden token burns before your bill shocks you</div>
      </div>
    </div>
    <div class="feature">
      <div class="feature-icon">⚡</div>
      <div>
        <div class="feature-title">AgentGuard kill switch</div>
        <div class="feature-desc">Auto-stop rogue agents, unauthorized API calls & compliance risks</div>
      </div>
    </div>
  </div>

  <!-- Steps -->
  <div class="onboarding-progress">
    <div class="onboarding-title">How it works</div>
    <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="step active" id="step-1">
      <div class="step-num">1</div>
      <div>Create free account</div>
    </div>
    <div class="step" id="step-2">
      <div class="step-num">2</div>
      <div>Import an API collection</div>
    </div>
    <div class="step" id="step-3">
      <div class="step-num">3</div>
      <div>Run instant security scan</div>
    </div>
    <div class="step" id="step-4">
      <div class="step-num">4</div>
      <div>Fix issues with one click</div>
    </div>
  </div>

  <div class="quick-actions">
    <div class="quick-actions-title">Quick Actions</div>
    <div class="quick-action" id="quick-scan">
      <span class="quick-action-icon">⚡</span>
      <span>Scan Current File</span>
      <span class="quick-action-kbd">Ctrl+Shift+S</span>
    </div>
    <div class="quick-action" id="quick-import">
      <span class="quick-action-icon">📥</span>
      <span>Import Collection</span>
      <span class="quick-action-kbd">Ctrl+Shift+I</span>
    </div>
    <div class="quick-action" id="quick-docs">
      <span class="quick-action-icon">📖</span>
      <span>Open Documentation</span>
    </div>
  </div>

  <script nonce="${nonce}">
    (function () {
      var vscode = acquireVsCodeApi();
      var connectBtn = document.getElementById("connect-btn");
      var createAccountBtn = document.getElementById("create-account-btn");
      var hasKeyToggle = document.getElementById("has-key-toggle");
      var keySection = document.getElementById("key-section");
      var apiKeyInput = document.getElementById("api-key-input");
      var errorFeedback = document.getElementById("error-feedback");
      var errorFeedbackMsg = document.getElementById("error-feedback-msg");
      var progressFill = document.getElementById("progress-fill");

      // Animate progress bar
      setTimeout(function() {
        if (progressFill) progressFill.style.width = "25%";
      }, 300);

      function showError(msg) {
        if (errorFeedback && errorFeedbackMsg) {
          errorFeedbackMsg.textContent = msg;
          errorFeedback.classList.add("visible");
        }
        if (apiKeyInput) {
          apiKeyInput.style.borderColor = "#ef4444";
          apiKeyInput.style.boxShadow = "0 0 0 2px rgba(239,68,68,0.15)";
        }
      }

      function hideError() {
        if (errorFeedback) errorFeedback.classList.remove("visible");
        if (apiKeyInput) {
          apiKeyInput.style.borderColor = "";
          apiKeyInput.style.boxShadow = "";
        }
      }

      // Primary CTA: Create free account (lowest friction)
      if (createAccountBtn) {
        createAccountBtn.addEventListener("click", function () {
          createAccountBtn.textContent = "Opening browser...";
          vscode.postMessage({ type: "createAccount" });
          setTimeout(function() { createAccountBtn.textContent = "Get Started Free \u2192"; }, 3000);
        });
      }

      // Toggle API key input for returning users
      if (hasKeyToggle && keySection) {
        hasKeyToggle.addEventListener("click", function () {
          var isHidden = keySection.style.display === "none";
          keySection.style.display = isHidden ? "block" : "none";
          hasKeyToggle.textContent = isHidden ? "Hide API key input" : "Already have an API key?";
          if (isHidden && apiKeyInput) apiKeyInput.focus();
        });
      }

      // Connect with API key
      if (connectBtn) {
        connectBtn.addEventListener("click", function () {
          var key = apiKeyInput ? apiKeyInput.value.trim() : "";
          hideError();
          if (!key) { showError("Please enter your API key."); return; }
          if (key.length < 8) { showError("API key must be at least 8 characters."); return; }
          if (!key.startsWith("dp_")) { showError('API key should start with "dp_". Check your Rakshex dashboard.'); return; }
          connectBtn.disabled = true;
          connectBtn.textContent = "Connecting\u2026";
          vscode.postMessage({ type: "connect", apiKey: key });
        });
      }

      if (apiKeyInput) {
        apiKeyInput.addEventListener("input", hideError);
        apiKeyInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") connectBtn.click();
        });
      }

      // Quick actions
      document.getElementById("quick-scan")?.addEventListener("click", function () {
        vscode.postMessage({ type: "quickAction", action: "scan" });
      });
      document.getElementById("quick-import")?.addEventListener("click", function () {
        vscode.postMessage({ type: "quickAction", action: "import" });
      });
      document.getElementById("quick-docs")?.addEventListener("click", function () {
        vscode.postMessage({ type: "openDocs" });
      });

      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (msg && msg.type === "connectError") {
          showError(msg.message || "Connection failed. Check your API key.");
          if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = "Connect to Rakshex"; }
        }
      });
    }());
  </script>
</body>
</html>`;
  }

  public postConnectError(message: string): void {
    this.view?.webview.postMessage({ type: "connectError", message });
  }
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
