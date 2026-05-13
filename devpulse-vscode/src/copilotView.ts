/**
 * DevPulse Security Copilot Webview Panel.
 *
 * A chat interface that lets users ask security questions, explain findings,
 * and get fix suggestions using the copilotAsk tRPC endpoint.
 *
 * Uses VS Code CSS variables for theme-aware styling.
 */
import * as crypto from "crypto";
import * as vscode from "vscode";
import type { DevPulseApi } from "./api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isFallback?: boolean;
}

export class CopilotViewPanel {
  private static current: CopilotViewPanel | undefined;
  public static readonly viewType = "devpulse.copilot";

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private conversationHistory: ChatMessage[] = [];
  private connectionStatus: "connected" | "offline" = "connected";

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly api: DevPulseApi
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      msg => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "askQuestion") {
          void this.handleQuestion(msg.question as string, msg.context as string | undefined);
        } else if (msg.type === "clearHistory") {
          this.conversationHistory = [];
          this.updateChatUI("idle");
        } else if (msg.type === "quickAction") {
          void this.handleQuickAction(msg.action as string);
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    api: DevPulseApi
  ): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (CopilotViewPanel.current) {
      CopilotViewPanel.current.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CopilotViewPanel.viewType,
      "DevPulse Security Copilot",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    CopilotViewPanel.current = new CopilotViewPanel(panel, api);
    panel.webview.html = CopilotViewPanel.current._getHtmlForWebview(panel.webview);
  }

  private async handleQuickAction(action: string): Promise<void> {
    let question = "";
    if (action === "explainFinding") {
      question = "Explain my most critical security finding and its impact.";
    } else if (action === "suggestFix") {
      question = "Suggest a fix for my most critical security finding.";
    } else if (action === "securityReview") {
      question = "Give me a security review of my current findings and overall posture.";
    }
    if (question) {
      void this.handleQuestion(question, action);
    }
  }

  private async handleQuestion(question: string, context?: string): Promise<void> {
    // Add user message
    const userMsg: ChatMessage = {
      role: "user",
      content: question,
      timestamp: new Date().toLocaleTimeString(),
    };
    this.conversationHistory.push(userMsg);
    this.updateChatUI("thinking");

    try {
      // Use the copilotAsk tRPC endpoint
      const result = await this.api.copilotAsk(question, context ?? "general");
      this.connectionStatus = "connected";
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.response ?? "I couldn't generate a response. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      this.conversationHistory.push(assistantMsg);
    } catch {
      // Fallback: generate a helpful response based on the question
      this.connectionStatus = "offline";
      const fallbackResponse = this.generateFallbackResponse(question);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: fallbackResponse,
        timestamp: new Date().toLocaleTimeString(),
        isFallback: true,
      };
      this.conversationHistory.push(assistantMsg);
    }

    this.updateChatUI("idle");
  }

  private generateFallbackResponse(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("explain") && q.includes("finding")) {
      return "I'd be happy to explain your findings, but I need a connection to the DevPulse backend to analyze them. Please check your API key and connection settings. In the meantime, critical findings typically involve SQL injection, authentication bypasses, or data exposure vulnerabilities that need immediate attention.";
    }
    if (q.includes("fix") || q.includes("suggest")) {
      return "To suggest fixes, I need access to your findings through the DevPulse backend. Common security fixes include: using parameterized queries for SQL injection, implementing proper input validation for XSS, and ensuring authentication on all sensitive endpoints. Check your connection settings and try again.";
    }
    if (q.includes("review") || q.includes("posture")) {
      return "For a comprehensive security review, I need to connect to your DevPulse workspace. This allows me to analyze your findings, identify patterns, and provide prioritized recommendations. Please verify your API key is configured correctly.";
    }
    return "I'm your DevPulse Security Copilot. I can help explain findings, suggest fixes, and review your security posture. I need a connection to the DevPulse backend for detailed analysis. Please check your API key and network settings.";
  }

  private updateChatUI(status: "thinking" | "idle"): void {
    this.panel.webview.postMessage({
      type: "updateChat",
      messages: this.conversationHistory,
      status,
      connectionStatus: this.connectionStatus,
    });
  }

  public dispose(): void {
    CopilotViewPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }

  private _getHtmlForWebview(
    webview: vscode.Webview
  ): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join("; ");

    const messagesJson = JSON.stringify(this.conversationHistory);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPulse Security Copilot</title>
  <style>
    :root { color-scheme: var(--vscode-color-scheme, dark); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column; height: 100vh;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: 13px;
      line-height: 1.5;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex; align-items: center; justify-content: space-between;
    }
    .header h1 {
      font-size: 15px; font-weight: 600;
      color: var(--vscode-editor-foreground);
    }
    .header-right {
      display: flex; gap: 8px; align-items: center;
    }
    .connection-status {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 2px 8px; border-radius: 999px;
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .connection-status.connected {
      background: #22c55e20; color: #22c55e;
    }
    .connection-status.offline {
      background: #ef444420; color: #ef4444;
    }
    .connection-dot {
      width: 6px; height: 6px; border-radius: 50%;
    }
    .connection-status.connected .connection-dot { background: #22c55e; }
    .connection-status.offline .connection-dot { background: #ef4444; }
    .header-actions { display: flex; gap: 6px; }
    .btn-icon {
      background: none; border: none; cursor: pointer;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      font-size: 16px; padding: 2px 6px; border-radius: 3px;
      transition: color 0.15s, background 0.15s;
    }
    .btn-icon:hover {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-toolbar-hoverBackground, #5a5d5e);
    }

    /* Quick actions */
    .quick-actions {
      display: flex; gap: 6px; padding: 10px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      flex-wrap: wrap;
    }
    .quick-btn {
      padding: 4px 10px; border-radius: 12px; font-size: 11px;
      cursor: pointer; border: 1px solid var(--vscode-panel-border, #3c3c3c);
      background: transparent; color: var(--vscode-descriptionForeground, #8b8b8b);
      transition: all 0.15s;
    }
    .quick-btn:hover {
      border-color: var(--vscode-focusBorder, #007fd4);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    /* Chat area */
    .chat-area {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .chat-area::-webkit-scrollbar { width: 6px; }
    .chat-area::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, #79797966);
      border-radius: 3px;
    }

    .message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .message-user {
      align-self: flex-end;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border-bottom-right-radius: 2px;
    }
    .message-assistant {
      align-self: flex-start;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-bottom-left-radius: 2px;
    }
    .message-fallback {
      align-self: flex-start;
      background: #f9731610;
      border: 1px solid #f9731640;
      border-left: 3px solid #f97316;
      border-bottom-left-radius: 2px;
    }
    .fallback-banner {
      display: flex; align-items: center; gap: 5px;
      margin-bottom: 6px; padding-bottom: 6px;
      border-bottom: 1px solid #f9731630;
      font-size: 10px; font-weight: 600;
      color: #f97316; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .fallback-banner-icon { font-size: 12px; }
    .message-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }
    .thinking-indicator {
      align-self: flex-start;
      padding: 8px 14px;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      font-style: italic;
    }
    .thinking-dots::after {
      content: '';
      animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }

    /* Input area */
    .input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex; gap: 8px; align-items: flex-end;
    }
    .input-area textarea {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      font-size: 13px;
      font-family: var(--vscode-font-family);
      resize: none;
      min-height: 36px;
      max-height: 120px;
      outline: none;
      transition: border-color 0.15s;
    }
    .input-area textarea:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }
    .send-btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.15s;
    }
    .send-btn:hover { opacity: 0.9; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Empty state */
    .empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: var(--vscode-descriptionForeground, #8b8b8b);
      padding: 24px;
      text-align: center;
    }
    .empty-state-icon { font-size: 36px; margin-bottom: 12px; }
    .empty-state h2 { font-size: 15px; color: var(--vscode-editor-foreground); margin-bottom: 4px; }
    .empty-state p { font-size: 12px; }

    code {
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      padding: 1px 4px; border-radius: 3px; font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>\u{1F916} DevPulse Copilot</h1>
    <div class="header-right">
      <div class="connection-status connected" id="connection-status">
        <span class="connection-dot"></span>
        <span id="connection-label">Connected to AI</span>
      </div>
      <div class="header-actions">
        <button class="btn-icon" id="clear-btn" title="Clear conversation">\u{1F5D1}</button>
      </div>
    </div>
  </div>

  <div class="quick-actions">
    <button class="quick-btn" data-action="explainFinding">🔍 Explain Finding</button>
    <button class="quick-btn" data-action="suggestFix">💡 Suggest Fix</button>
    <button class="quick-btn" data-action="securityReview">🛡 Security Review</button>
  </div>

  <div class="chat-area" id="chat-area">
    <div class="empty-state" id="empty-state">
      <div class="empty-state-icon">🤖</div>
      <h2>DevPulse Security Copilot</h2>
      <p>Ask me about your security findings, request fix suggestions, or get a security review.</p>
    </div>
  </div>

  <div class="input-area">
    <textarea id="message-input" placeholder="Ask a security question..." rows="1"></textarea>
    <button class="send-btn" id="send-btn">➤</button>
  </div>

  <script nonce="${nonce}">
    (function () {
      var vscode = acquireVsCodeApi();
      var messages = ${messagesJson};
      var chatArea = document.getElementById("chat-area");
      var emptyState = document.getElementById("empty-state");
      var messageInput = document.getElementById("message-input");
      var sendBtn = document.getElementById("send-btn");
      var clearBtn = document.getElementById("clear-btn");
      var currentStatus = "idle";

      function renderMessages() {
        // Remove all children except empty state
        var children = Array.from(chatArea.children);
        children.forEach(function (c) {
          if (c.id !== "empty-state") chatArea.removeChild(c);
        });

        if (messages.length === 0 && currentStatus !== "thinking") {
          emptyState.style.display = "";
          return;
        }
        emptyState.style.display = "none";

        messages.forEach(function (m) {
          var div = document.createElement("div");
          div.className = "message " + (m.isFallback ? "message-fallback" : "message-" + m.role);
          if (m.isFallback) {
            var banner = document.createElement("div");
            banner.className = "fallback-banner";
            banner.innerHTML = '<span class="fallback-banner-icon">\u26A0</span> Offline Mode \u2014 This is a local suggestion, not an AI response';
            div.appendChild(banner);
          }
          var contentSpan = document.createElement("span");
          contentSpan.textContent = m.content;
          div.appendChild(contentSpan);
          var time = document.createElement("div");
          time.className = "message-time";
          time.textContent = m.timestamp;
          div.appendChild(time);
          chatArea.appendChild(div);
        });

        if (currentStatus === "thinking") {
          var thinking = document.createElement("div");
          thinking.className = "thinking-indicator";
          thinking.innerHTML = "Thinking<span class='thinking-dots'></span>";
          chatArea.appendChild(thinking);
        }

        chatArea.scrollTop = chatArea.scrollHeight;
      }

      function sendMessage() {
        var text = messageInput.value.trim();
        if (!text) return;
        messageInput.value = "";
        messageInput.style.height = "36px";
        vscode.postMessage({ type: "askQuestion", question: text });
      }

      sendBtn.addEventListener("click", sendMessage);
      messageInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      messageInput.addEventListener("input", function () {
        this.style.height = "36px";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
      });

      clearBtn.addEventListener("click", function () {
        vscode.postMessage({ type: "clearHistory" });
      });

      document.querySelectorAll(".quick-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          vscode.postMessage({ type: "quickAction", action: this.getAttribute("data-action") });
        });
      });

      // Handle messages from extension
      window.addEventListener("message", function (event) {
        var msg = event.data;
        if (msg && msg.type === "updateChat") {
          messages = msg.messages || [];
          currentStatus = msg.status || "idle";
          var cs = msg.connectionStatus || "connected";
          var statusEl = document.getElementById("connection-status");
          var labelEl = document.getElementById("connection-label");
          if (statusEl) {
            statusEl.className = "connection-status " + cs;
          }
          if (labelEl) {
            labelEl.textContent = cs === "connected" ? "Connected to AI" : "Offline Mode";
          }
          renderMessages();
        }
      });

      renderMessages();
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
