/**
 * Dry-runner for the Rakshex Agent Firewall policy.
 *
 * Takes text from the editor and evaluates it as an `llm.prompt` semantic
 * action against the live firewall policy in shadow mode: the policy chain
 * runs and returns a decision, nothing executes, no tokens are charged.
 *
 * Honest boundary: this tests the *action policy* (allow/deny/approve),
 * not prompt-content analysis. The firewall governs actions, not words.
 */
import * as vscode from "vscode";
import { RakshexApi } from "./api";

interface PolicyVerdict {
  decision: "allowed" | "blocked";
  reason?: string;
  detail?: Record<string, unknown>;
}

export async function runGatewayTest(
  api: RakshexApi,
  workspaceId: number,
  promptText: string,
): Promise<PolicyVerdict> {
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await api.evaluateAction({
    workspaceId,
    requestId,
    mode: "shadow",
    action: {
      name: "llm.prompt",
      domain: "unknown",
      effect: "unknown",
      parameters: { prompt: promptText },
      raw: { provider: "vscode-extension", operation: "gateway-test" },
    },
  });
  if (result.decision === "ALLOW") {
    return { decision: "allowed" };
  }
  return {
    decision: "blocked",
    reason: result.reason ?? `policy decision: ${result.decision}`,
  };
}

function readWorkspaceId(): number {
  const raw = vscode.workspace.getConfiguration("rakshex").get<number>("workspaceId", 0);
  return Number.isInteger(raw) ? (raw as number) : 0;
}

export async function registerGatewayCommand(
  context: vscode.ExtensionContext,
  api: RakshexApi,
  readApiKey: () => string | undefined,
): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand("rakshex.testPromptThroughGateway", async () => {
      const apiKey = readApiKey();
      if (!apiKey) {
        void vscode.window.showWarningMessage(
          "Rakshex: sign in first to test prompts through the gateway.",
        );
        return;
      }
      const workspaceId = readWorkspaceId();
      if (!workspaceId || workspaceId <= 0) {
        void vscode.window.showWarningMessage(
          "Rakshex: set your workspace ID first (Settings → Rakshex: Workspace Id).",
        );
        return;
      }
      // Optional self-host override; empty = the configured API origin.
      const gatewayOverride = vscode.workspace
        .getConfiguration("rakshex")
        .get<string>("gatewayUrl", "")
        .trim();
      const evalApi = gatewayOverride ? new RakshexApi(() => gatewayOverride, readApiKey) : api;
      const editor = vscode.window.activeTextEditor;
      const initial =
        editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : "";
      const prompt = await vscode.window.showInputBox({
        title: "Rakshex — dry-run through firewall policy",
        prompt:
          "Paste the prompt to evaluate. Runs in shadow mode against the live policy — decision only, nothing executes.",
        value: initial,
        ignoreFocusOut: true,
      });
      if (!prompt) return;
      try {
        const verdict = await runGatewayTest(evalApi, workspaceId, prompt);
        if (verdict.decision === "allowed") {
          void vscode.window.showInformationMessage(
            "Rakshex: the firewall policy would ALLOW this action (shadow mode).",
          );
        } else {
          void vscode.window.showWarningMessage(
            `Rakshex: the firewall policy would BLOCK this action — ${verdict.reason ?? "policy decision"}.`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Rakshex: policy dry-run failed — ${msg}`);
      }
    }),
  );
}
