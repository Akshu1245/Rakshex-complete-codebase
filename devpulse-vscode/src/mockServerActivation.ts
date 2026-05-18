/**
 * DevPulse Mock Server — Extension Activation Glue
 * =================================================
 * Wires `mockServer.ts` into the VS Code extension lifecycle.
 *
 * How to activate mock mode:
 *   1. VS Code setting:  "devpulse.mockMode": true
 *      (add to .vscode/settings.json in the workspace under test)
 *   2. Environment variable: DEVPULSE_MOCK=true
 *      (set before launching the Extension Development Host)
 *
 * When active:
 *   - The mock fetch interceptor is installed before `DevPulseApi` makes
 *     any network call.
 *   - A status bar badge "[MOCK]" is appended so testers can't miss it.
 *   - `devpulse.resetMockState` command resets all mock state to pristine
 *     without reloading the extension.
 *   - `devpulse.setMockMode` command lets testers switch between
 *     "normal" / "offline" / "slow" at runtime.
 *
 * Drop-in usage in extension.ts:
 * ─────────────────────────────
 *   import { maybeInstallMock } from "./mockServerActivation";
 *
 *   export function activate(context: vscode.ExtensionContext) {
 *     const uninstallMock = maybeInstallMock(context);
 *     if (uninstallMock) {
 *       context.subscriptions.push({ dispose: uninstallMock });
 *     }
 *     // ... rest of activation unchanged
 *   }
 */

import * as vscode from "vscode";
import {
  installMockFetch,
  resetMockState,
  mockState,
  type MockState,
} from "./mockServer";
import { getConfiguredBaseUrl } from "./api";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if mock mode should be active and, if so, install the interceptor.
 * Returns an `uninstall` function (for `context.subscriptions`) or `null`.
 */
export function maybeInstallMock(
  context: vscode.ExtensionContext,
): (() => void) | null {
  if (!isMockModeEnabled()) return null;

  const baseUrl = getConfiguredBaseUrl();
  const uninstall = installMockFetch(baseUrl);

  registerMockCommands(context);
  showMockBadge();

  vscode.window.showInformationMessage(
    "⚠️ DevPulse is running in MOCK mode. " +
      "All API calls are intercepted — no real backend required.",
    "OK",
  );

  return uninstall;
}

// ---------------------------------------------------------------------------
// Mock-only commands
// ---------------------------------------------------------------------------

function registerMockCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.resetMockState", () => {
      resetMockState();
      void vscode.window.showInformationMessage(
        "🔄 DevPulse mock state reset. Onboarding starts fresh.",
      );
    }),

    vscode.commands.registerCommand(
      "devpulse.setMockMode",
      async () => {
        const picked = await vscode.window.showQuickPick(
          [
            {
              label: "$(check) Normal",
              description: "All mock responses return immediately",
              value: "normal" as MockState["mode"],
            },
            {
              label: "$(debug-disconnect) Offline",
              description: "Simulate network failure (tests retry logic)",
              value: "offline" as MockState["mode"],
            },
            {
              label: "$(watch) Slow",
              description: "Add 1.5 s latency per response (tests loading states)",
              value: "slow" as MockState["mode"],
            },
          ],
          { title: "DevPulse: Set Mock Mode" },
        );
        if (picked) {
          mockState.mode = picked.value;
          void vscode.window.showInformationMessage(
            `DevPulse mock mode set to: ${picked.value}`,
          );
        }
      },
    ),

    /**
     * Dump the current mock state to an output channel — useful for
     * manually verifying telemetry events during the validation pass.
     */
    vscode.commands.registerCommand("devpulse.dumpMockState", () => {
      const channel = vscode.window.createOutputChannel("DevPulse Mock State");
      channel.clear();
      channel.appendLine(JSON.stringify(mockState, null, 2));
      channel.show(true);
    }),
  );
}

// ---------------------------------------------------------------------------
// Status bar badge
// ---------------------------------------------------------------------------

function showMockBadge(): void {
  const badge = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    // Render right after the DevPulse main status bar item (priority 98)
    97,
  );
  badge.text = "$(beaker) [MOCK]";
  badge.tooltip =
    "DevPulse is in mock mode — no real API calls are made.\n" +
    "Commands: DevPulse: Reset Mock State, DevPulse: Set Mock Mode, DevPulse: Dump Mock State";
  badge.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  badge.command = "devpulse.setMockMode";
  badge.show();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMockModeEnabled(): boolean {
  const fromSetting = vscode.workspace
    .getConfiguration("devpulse")
    .get<boolean>("mockMode", false);
  const fromEnv = process.env["DEVPULSE_MOCK"] === "true";
  return fromSetting || fromEnv;
}
