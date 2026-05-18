/**
 * extension.ts — Mock Mode Patch
 * ================================
 * Minimal diff to apply to the top of `extension.ts`'s `activate()` function.
 *
 * BEFORE (inside activate()):
 * ─────────────────────────────────────────────────────────────────────────
 *   export async function activate(context: vscode.ExtensionContext): Promise<void> {
 *     const baseUrl = getConfiguredBaseUrl();
 *     const api = new DevPulseApi(() => baseUrl, () => context.secrets.get("devpulse.apiKey") as any);
 *     // ...
 *   }
 *
 * AFTER:
 * ─────────────────────────────────────────────────────────────────────────
 *   import { maybeInstallMock } from "./mockServerActivation";
 *
 *   export async function activate(context: vscode.ExtensionContext): Promise<void> {
 *     // ↓ ADD THIS — must come BEFORE DevPulseApi is used
 *     const uninstallMock = maybeInstallMock(context);
 *     if (uninstallMock) {
 *       context.subscriptions.push({ dispose: uninstallMock });
 *     }
 *     // ↓ Everything else unchanged ↓
 *     const baseUrl = getConfiguredBaseUrl();
 *     const api = new DevPulseApi(() => baseUrl, () => context.secrets.get("devpulse.apiKey") as any);
 *     // ...
 *   }
 *
 * That's the entire change to extension.ts.
 *
 * Package.json additions:
 * ─────────────────────────────────────────────────────────────────────────
 * Add to "contributes.configuration.properties":
 *
 *   "devpulse.mockMode": {
 *     "type": "boolean",
 *     "default": false,
 *     "description": "Enable mock mode: all DevPulse API calls are intercepted locally. No real backend required. Ideal for onboarding validation and UX testing."
 *   }
 *
 * Add to "contributes.commands":
 *
 *   { "command": "devpulse.resetMockState",  "title": "DevPulse: Reset Mock State",  "category": "DevPulse" },
 *   { "command": "devpulse.setMockMode",     "title": "DevPulse: Set Mock Mode",     "category": "DevPulse" },
 *   { "command": "devpulse.dumpMockState",   "title": "DevPulse: Dump Mock State",   "category": "DevPulse" }
 *
 * Activation via .vscode/settings.json (in workspace under test):
 * ─────────────────────────────────────────────────────────────────────────
 *   {
 *     "devpulse.mockMode": true
 *   }
 *
 * Or via environment variable (launch.json / shell):
 * ─────────────────────────────────────────────────────────────────────────
 *   DEVPULSE_MOCK=true code --extensionDevelopmentPath=.
 */

// This file is documentation-only. No runtime exports.
export {};
