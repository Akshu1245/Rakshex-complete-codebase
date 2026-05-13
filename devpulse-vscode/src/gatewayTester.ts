/**
 * Inline test runner for the DevPulse gateway.
 *
 * Lets a developer paste a prompt directly from VS Code and see whether it
 * would be blocked by the live gateway policy chain (PII redaction, prompt
 * injection, kill-switch, token budget, tool approval).
 *
 * The command is disconnected from the model — it sends `dry_run=true`
 * which causes the gateway to short-circuit after the policy chain runs.
 * No tokens are charged.
 */
import * as vscode from "vscode";

interface PolicyVerdict {
  decision: "allowed" | "blocked";
  reason?: string;
  detail?: Record<string, unknown>;
  redactedMessages?: Array<{ role: string; content: string }>;
}

export async function runGatewayTest(
  gatewayUrl: string,
  apiKey: string,
  promptText: string
): Promise<PolicyVerdict> {
  const url = `${gatewayUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-devpulse-dry-run": "true",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: promptText }],
      max_tokens: 1,
    }),
  });
  if (resp.status === 200) {
    return { decision: "allowed" };
  }
  let body: { error?: { code?: string; message?: string; detail?: Record<string, unknown> } };
  try {
    body = (await resp.json()) as typeof body;
  } catch {
    body = {};
  }
  return {
    decision: "blocked",
    ...(body.error?.code ? { reason: body.error.code } : {}),
    ...(body.error?.detail ? { detail: body.error.detail } : {}),
  };
}

export async function registerGatewayCommand(
  context: vscode.ExtensionContext,
  readApiKey: () => string | undefined
): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.testPromptThroughGateway", async () => {
      const apiKey = readApiKey();
      if (!apiKey) {
        void vscode.window.showWarningMessage(
          "DevPulse: sign in first to test prompts through the gateway."
        );
        return;
      }
      const cfg = vscode.workspace.getConfiguration("devpulse");
      const gatewayUrl =
        cfg.get<string>("gatewayUrl") ?? "http://localhost:8081";
      const editor = vscode.window.activeTextEditor;
      const initial =
        editor && !editor.selection.isEmpty
          ? editor.document.getText(editor.selection)
          : "";
      const prompt = await vscode.window.showInputBox({
        title: "DevPulse — test prompt through gateway",
        prompt:
          "Paste the prompt you want to validate. The gateway will run all policies and return the decision.",
        value: initial,
        ignoreFocusOut: true,
      });
      if (!prompt) return;
      try {
        const verdict = await runGatewayTest(gatewayUrl, apiKey, prompt);
        if (verdict.decision === "allowed") {
          void vscode.window.showInformationMessage(
            "DevPulse: prompt would be allowed by all policies."
          );
        } else {
          void vscode.window.showWarningMessage(
            `DevPulse: prompt would be BLOCKED — ${verdict.reason ?? "policy violation"}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          `DevPulse: gateway test failed — ${msg}`
        );
      }
    })
  );
}
