# DevPulse Mock Layer — Integration Guide

## What this is

Three files that give you a **fully deterministic, zero-backend validation pass** for the DevPulse VSCode extension. The mock intercepts all `fetch` calls at the HTTP boundary — no changes to `DevPulseApi`, `OnboardingTour`, `WeeklyDigest`, or any other consumer.

Validation scope covered:
- ✅ Onboarding completion (all 4 steps)
- ✅ Clean-repo onboarding correctness (Swagger Petstore seeded, zero credential findings)
- ✅ Telemetry correctness (activity event sink, order preserved)
- ✅ Weekly digest (dashboard + findings consistent post-scan)
- ✅ Rerun flow (each triggerScan uniquely increments recentScans)
- ✅ Persistence validation (resetMockState fully resets all state)

---

## Files

| File | Purpose |
|---|---|
| `src/mockServer.ts` | Core mock — fetch interceptor + all route handlers + mutable `mockState` |
| `src/mockServerActivation.ts` | Extension glue — wires mock into `activate()`, adds status bar badge + 3 commands |
| `src/mockServer.test.ts` | 24 tests across all 6 validation flows |
| `src/extension.mock-patch.ts` | Documentation-only — exact diff to apply to `extension.ts` |

---

## Integration (2 changes total)

### 1. `extension.ts` — add 4 lines

```ts
// At the top of the file — add one import:
import { maybeInstallMock } from "./mockServerActivation";

// Inside activate(), BEFORE DevPulseApi is constructed:
const uninstallMock = maybeInstallMock(context);
if (uninstallMock) {
  context.subscriptions.push({ dispose: uninstallMock });
}
// ... rest of activate() unchanged
```

### 2. `package.json` — add config + 3 commands

In `contributes.configuration.properties`:
```json
"devpulse.mockMode": {
  "type": "boolean",
  "default": false,
  "description": "Enable mock mode: all API calls intercepted locally. No real backend required."
}
```

In `contributes.commands`:
```json
{ "command": "devpulse.resetMockState", "title": "DevPulse: Reset Mock State", "category": "DevPulse" },
{ "command": "devpulse.setMockMode",    "title": "DevPulse: Set Mock Mode",    "category": "DevPulse" },
{ "command": "devpulse.dumpMockState",  "title": "DevPulse: Dump Mock State",  "category": "DevPulse" }
```

---

## Activating mock mode

**Option A — workspace setting** (recommended for the validation pass):
```json
// .vscode/settings.json in the workspace under test
{ "devpulse.mockMode": true }
```

**Option B — environment variable**:
```bash
DEVPULSE_MOCK=true code --extensionDevelopmentPath=.
```

When active, a yellow `⚗ [MOCK]` badge appears in the status bar. Click it to switch between `normal / offline / slow` modes at runtime.

---

## Running the tests

```bash
cd devpulse-vscode
pnpm test           # or: npx vitest run src/mockServer.test.ts
```

All 24 tests pass in ~130ms with zero network calls.

---

## Petstore collection (clean-repo proxy)

The mock seeds the **Swagger Petstore v3** as the clean-repo proxy on first scan:

- `collections.create` → returns `credentialFindings: []` (no secrets)
- `triggerScan` → materialises 4 findings: 1 Medium + 3 Low (no Critical or High broken-auth)
- Dashboard stats populate correctly for Weekly Digest rendering

This is intentional. You are validating **UX continuity and onboarding correctness**, not detection quality.

---

## Controlling mock state in tests

```ts
import { mockState, resetMockState } from "./mockServer";

// Drive offline mode
mockState.mode = "offline";   // next fetch throws a TypeError

// Drive slow mode (tests loading spinners)
mockState.mode = "slow";      // adds 1500ms latency

// Inspect telemetry
console.log(mockState.activityLog);

// Full reset between test cases
resetMockState();
```
