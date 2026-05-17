/**
 * DevPulse VS Code extension entrypoint.
 *
 * Architecture:
 *   - API key is stored in vscode.SecretStorage (never in settings).
 *   - DevPulseApi is the single fetch wrapper over /trpc/vscodeExtension.*.
 *   - FindingsTreeProvider + AutoFixTreeProvider + DevPulseStatusBar + HeartbeatService consume it.
 *   - `refresh` is debounced via a simple in-flight guard so rapid command
 *     invocations don't stack.
 *   - Workspace trust is checked before running shadow API scans.
 */
import * as vscode from "vscode";
import { DevPulseApi, DevPulseApiError, getConfiguredBaseUrl, type FindingStatus } from "./api";
import { FindingsTreeProvider } from "./findingsProvider";
import { DevPulseStatusBar } from "./statusBar";
import { HeartbeatService } from "./heartbeat";
import { SecurityWebviewPanel } from "./securityWebviewPanel";
import { SettingsWebviewPanel } from "./settingsWebview";
import { AutoFixTreeProvider, extractSuggestionFromNode } from "./autofixProvider";
import { CopilotViewPanel } from "./copilotView";
import { WelcomeViewProvider } from "./welcomeView";
import { ValueMomentTracker } from "./valueMoments";
import { EngagementTracker } from "./engagementTracker";
import { WeeklyDigestCommand } from "./weeklyDigest";
import { FeedbackCommand } from "./feedback";
import { OnboardingTour } from "./onboardingTour";
import { HealthCheckCommand } from "./healthCheck";
import { registerGatewayCommand } from "./gatewayTester";
import { registerShadowApiCommand } from "./shadowApi";
import { PostmanImportCommand } from "./postmanImport";
import { ScanCurrentFileCommand } from "./scanCurrentFile";

const SECRET_API_KEY = "devpulse.apiKey";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let cachedApiKey: string | undefined;
  const readApiKey = () => cachedApiKey;

  const api = new DevPulseApi(getConfiguredBaseUrl, readApiKey);
  const findingsProvider = new FindingsTreeProvider(api);
  const autoFixProvider = new AutoFixTreeProvider(api);
  const valueTracker = new ValueMomentTracker(context);
  const engagementTracker = new EngagementTracker(context, api);
  const statusBar = new DevPulseStatusBar(api, () => engagementTracker.getScanStreak());
  const heartbeat = new HeartbeatService(api, () => Boolean(cachedApiKey));

  engagementTracker.recordOnboardingStep("installed");

  cachedApiKey = await context.secrets.get(SECRET_API_KEY);

  // Add heartbeat to subscriptions so it gets cleaned up on deactivation
  context.subscriptions.push(heartbeat);

  const treeView = vscode.window.createTreeView("devpulse.findings", {
    treeDataProvider: findingsProvider,
    showCollapseAll: true,
  });

  const autoFixTreeView = vscode.window.createTreeView("devpulse.autofix", {
    treeDataProvider: autoFixProvider,
    showCollapseAll: true,
  });

  let refreshInFlight = false;
  const refresh = async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      await Promise.all([
        findingsProvider.refresh(),
        autoFixProvider.refresh(),
        statusBar.refresh(Boolean(cachedApiKey)),
      ]);
      // Track potential value moments after scan
      const findings = findingsProvider.getFindingsSnapshot?.() ?? [];
      const secrets = findings.filter(
        (f: { severity: string }) => f.severity === "critical",
      ).length;
      const high = findings.filter((f: { severity: string }) => f.severity === "high").length;
      if (secrets > 0 || high > 0) {
        engagementTracker.recordOnboardingStep("found_issue");
      }
      if (secrets > 0) {
        void valueTracker.record({
          type: "secret_found",
          value: secrets,
          description: `Found ${secrets} critical security issue(s)`,
        });
      }
      if (high > 0) {
        void valueTracker.record({
          type: "threat_blocked",
          value: high,
          description: `Found ${high} high-severity issue(s)`,
        });
      }
    } catch (err) {
      // Silently handle refresh failures so they don't break activation or UX
      statusBar.showError("Could not refresh data");
    } finally {
      refreshInFlight = false;
    }
  };

  const applySignedInState = async (signedIn: boolean) => {
    findingsProvider.setSignedIn(signedIn);
    autoFixProvider.setSignedIn(signedIn);
    await vscode.commands.executeCommand("setContext", "devpulse.signedIn", signedIn);
    if (signedIn) {
      // Don't block activation on refresh — fire-and-forget with error handling
      void refresh().catch(() => {
        statusBar.showError("Could not connect to DevPulse");
      });
    } else {
      statusBar.showSignedOut();
    }
  };

  await applySignedInState(Boolean(cachedApiKey));

  // --- Welcome View (activity bar) -----------------------------------------

  // Quick action handler for welcome view buttons
  const handleQuickAction = (action: string) => {
    switch (action) {
      case "scan":
        void vscode.commands.executeCommand("devpulse.scanCurrentFile");
        break;
      case "import":
        void vscode.commands.executeCommand("devpulse.importCollections");
        break;
    }
  };

  const welcomeProvider = new WelcomeViewProvider(
    context.extensionUri,
    async (apiKey: string) => {
      let valid = false;
      try {
        const result = await api.validateApiKey(apiKey);
        valid = result.valid;
        if (valid && result.user) {
          void vscode.window.showInformationMessage(
            `Signed in to DevPulse as ${result.user.email ?? result.user.name ?? "user"} (${result.user.plan}).`,
          );
          // Cost revelation: fetch and show cost breakdown
          try {
            const dashboard = await api.getDashboardData();
            if (dashboard && dashboard.weeklyCost > 0) {
              setTimeout(() => {
                void vscode.window
                  .showInformationMessage(
                    `💰 Cost Insight: Your weekly LLM spend is $${dashboard.weeklyCost.toFixed(2)}. View dashboard for per-endpoint breakdown.`,
                    "Open Dashboard",
                  )
                  .then((selection) => {
                    if (selection === "Open Dashboard") {
                      vscode.commands.executeCommand("devpulse.openDashboard");
                    }
                  });
              }, 2000);
            }
          } catch {
            // Silently skip cost revelation on auth error
          }
        }
      } catch (err) {
        const msg =
          err instanceof DevPulseApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        void vscode.window.showErrorMessage(`DevPulse: could not validate API key — ${msg}`);
        return;
      }

      if (!valid) {
        void vscode.window.showErrorMessage(
          "DevPulse: API key rejected. Generate a new one from the dashboard.",
        );
        return;
      }

      await context.secrets.store(SECRET_API_KEY, apiKey);
      cachedApiKey = apiKey;
      await applySignedInState(true);
      // Cost revelation after welcome-view connect
      try {
        const dashboard = await api.getDashboardData();
        if (dashboard && dashboard.weeklyCost > 0) {
          setTimeout(() => {
            void vscode.window
              .showInformationMessage(
                `💰 Cost Insight: Your weekly LLM spend is $${dashboard.weeklyCost.toFixed(2)}. View dashboard for per-endpoint breakdown.`,
                "Open Dashboard",
              )
              .then((selection) => {
                if (selection === "Open Dashboard") {
                  vscode.commands.executeCommand("devpulse.openDashboard");
                }
              });
          }, 3000);
        }
      } catch {
        // Silently skip
      }
    },
    handleQuickAction,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WelcomeViewProvider.viewType, welcomeProvider),
  );

  // --- commands ----------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.authenticate", async () => {
      const entered = await vscode.window.showInputBox({
        title: "DevPulse API Key",
        prompt:
          "Paste your DevPulse API key (generate one from Settings → API Keys on your dashboard).",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "dp_...",
        validateInput: (v) => (v.trim().length < 8 ? "API key looks too short" : null),
      });
      if (!entered) return;
      const key = entered.trim();

      let valid = false;
      try {
        const result = await api.validateApiKey(key);
        valid = result.valid;
        if (valid && result.user) {
          void vscode.window.showInformationMessage(
            `Signed in to DevPulse as ${result.user.email ?? result.user.name ?? "user"} (${result.user.plan}).`,
          );
        }
      } catch (err) {
        const msg =
          err instanceof DevPulseApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        void vscode.window.showErrorMessage(`DevPulse: could not validate API key — ${msg}`);
        return;
      }

      if (!valid) {
        void vscode.window.showErrorMessage(
          "DevPulse: API key rejected. Generate a new one from the dashboard.",
        );
        return;
      }

      await context.secrets.store(SECRET_API_KEY, key);
      cachedApiKey = key;
      await applySignedInState(true);
    }),

    vscode.commands.registerCommand("devpulse.signOut", async () => {
      await context.secrets.delete(SECRET_API_KEY);
      cachedApiKey = undefined;
      await applySignedInState(false);
      void vscode.window.showInformationMessage("DevPulse: signed out.");
    }),

    vscode.commands.registerCommand("devpulse.refresh", async () => {
      await refresh();
    }),

    vscode.commands.registerCommand("devpulse.openDashboard", async () => {
      const base = getConfiguredBaseUrl().replace(/\/+$/, "");
      void vscode.env.openExternal(vscode.Uri.parse(base));
    }),

    vscode.commands.registerCommand("devpulse.runScan", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("DevPulse: sign in with an API key first.");
        return;
      }
      let collections: { id: string; name: string }[] = [];
      try {
        collections = await api.listCollections();
      } catch (err) {
        void vscode.window.showErrorMessage(
          `DevPulse: could not load collections — ${errMessage(err)}`,
        );
        return;
      }
      if (collections.length === 0) {
        void vscode.window.showInformationMessage(
          "DevPulse: you don't have any collections yet. Create one from the dashboard first.",
        );
        return;
      }
      const picked = await vscode.window.showQuickPick(
        collections.map((c) => ({
          label: c.name,
          description: c.id,
          collectionId: c.id,
        })),
        { title: "DevPulse: pick a collection to scan" },
      );
      if (!picked) return;
      try {
        const scan = await api.triggerScan(picked.collectionId);
        void vscode.window.showInformationMessage(`DevPulse: scan queued (id ${scan.scanId}).`);
        engagementTracker.record("scan_run");
        engagementTracker.recordOnboardingStep("scanned");
        await refresh();
      } catch (err) {
        void vscode.window.showErrorMessage(`DevPulse: scan failed — ${errMessage(err)}`);
      }
    }),

    vscode.commands.registerCommand("devpulse.markFindingResolved", async (node: unknown) =>
      updateFindingStatusCmd(node, "resolved"),
    ),
    vscode.commands.registerCommand("devpulse.markFindingInProgress", async (node: unknown) =>
      updateFindingStatusCmd(node, "in-progress"),
    ),
    vscode.commands.registerCommand("devpulse.openSecurityPanel", () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("DevPulse: sign in with an API key first.");
        return;
      }
      engagementTracker.record("dashboard_opened");
      SecurityWebviewPanel.createOrShow(context.extensionUri, api);
    }),

    vscode.commands.registerCommand("devpulse.openSettings", () => {
      SettingsWebviewPanel.createOrShow(context.extensionUri, api, readApiKey, context);
    }),

    vscode.commands.registerCommand("devpulse.askSecurityCopilot", () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("DevPulse: sign in with an API key first.");
        return;
      }
      CopilotViewPanel.createOrShow(context.extensionUri, api);
    }),

    vscode.commands.registerCommand("devpulse.generateApiKey", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Sign in first.");
        return;
      }
      try {
        const result = await api.generateApiKey();
        await vscode.env.clipboard.writeText(result.apiKey);
        // Persist the new key so subsequent calls authenticate correctly.
        await context.secrets.store(SECRET_API_KEY, result.apiKey);
        cachedApiKey = result.apiKey;
        engagementTracker.recordOnboardingStep("signed_in");
        await applySignedInState(true);
        // Never show full API key in notifications — security risk
        void vscode.window.showInformationMessage(
          "Your new API key has been generated and copied to clipboard. Keep it secure.",
        );
      } catch (err) {
        void vscode.window.showErrorMessage(
          `DevPulse: could not generate API key — ${errMessage(err)}`,
        );
      }
    }),

    // Auto-fix: Apply Fix — insert suggested code into active editor or copy to clipboard
    vscode.commands.registerCommand("devpulse.applyAutoFix", async (node: unknown) => {
      const suggestion = extractSuggestionFromNode(node);
      if (!suggestion) {
        void vscode.window.showWarningMessage(
          "DevPulse: could not extract auto-fix suggestion from selection.",
        );
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Insert the fix code at the current cursor position
        const position = editor.selection.active;
        await editor.edit((editBuilder) => {
          editBuilder.insert(position, suggestion.code);
        });
        void vscode.window.showInformationMessage(
          `DevPulse: fix for "${suggestion.title}" inserted at cursor.`,
        );
      } else {
        // Fallback: copy to clipboard if no editor is open
        await vscode.env.clipboard.writeText(suggestion.code);
        void vscode.window.showInformationMessage(
          `DevPulse: fix code for "${suggestion.title}" copied to clipboard (no active editor to insert into).`,
        );
      }
    }),

    // Auto-fix: Dismiss
    vscode.commands.registerCommand("devpulse.dismissAutoFix", async (node: unknown) => {
      const suggestion = extractSuggestionFromNode(node);
      if (!suggestion) {
        void vscode.window.showWarningMessage(
          "DevPulse: could not extract auto-fix suggestion from selection.",
        );
        return;
      }
      autoFixProvider.dismiss(suggestion.id);
      void vscode.window.showInformationMessage(
        `DevPulse: dismissed suggestion "${suggestion.title}".`,
      );
    }),

    // Copy Finding ID
    vscode.commands.registerCommand("devpulse.copyFindingId", async (node: unknown) => {
      const findingId = extractFindingId(node);
      if (!findingId) {
        void vscode.window.showWarningMessage(
          "DevPulse: could not determine finding from selection.",
        );
        return;
      }
      await vscode.env.clipboard.writeText(findingId);
      void vscode.window.showInformationMessage(
        `DevPulse: finding ID ${findingId} copied to clipboard.`,
      );
    }),

    // Open in Dashboard
    vscode.commands.registerCommand("devpulse.openFindingInDashboard", async (node: unknown) => {
      const findingId = extractFindingId(node);
      if (!findingId) {
        void vscode.window.showWarningMessage(
          "DevPulse: could not determine finding from selection.",
        );
        return;
      }
      const base = getConfiguredBaseUrl().replace(/\/+$/, "");
      void vscode.env.openExternal(vscode.Uri.parse(`${base}/findings/${findingId}`));
    }),

    // Postman Collection Import
    vscode.commands.registerCommand("devpulse.importCollections", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("DevPulse: sign in first.");
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      let files: vscode.Uri[] = [];

      try {
        // Auto-detect Postman collections in workspace
        const detected = await api.findCollectionFiles();
        files = detected;
      } catch {
        // findCollectionFiles may fail silently — fall through to file picker
      }

      if (files.length === 0) {
        // No auto-detected files — open file picker
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: true,
          filters: {
            "API Collections": ["json", "yaml", "yml"],
          },
          title: "Import Postman / OpenAPI Collections",
        });
        if (!picked || picked.length === 0) return;
        files = picked;
      } else {
        // Show detected files + option to browse more
        const detectedItems = files.map((f) => ({
          label: vscode.workspace.asRelativePath(f),
          description: "detected in workspace",
          detail: f.fsPath,
        }));
        const browseItem = {
          label: "Browse for other files…",
          description: "",
          detail: "__browse__",
        };
        const items = [...detectedItems, browseItem];

        const pick = await vscode.window.showQuickPick(items, {
          placeHolder: `Found ${files.length} collection file(s) — select to import or browse`,
          canPickMany: false,
        });

        if (!pick) return;

        if (pick.detail === "__browse__") {
          const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: true,
            filters: { "API Collections": ["json", "yaml", "yml"] },
            title: "Import Postman / OpenAPI Collections",
          });
          if (!picked || picked.length === 0) return;
          files = picked;
        } else {
          files = [vscode.Uri.file(pick.detail)];
        }
      }

      // Import each file
      let imported = 0;
      let findings = 0;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "DevPulse: importing collections",
          cancellable: false,
        },
        async (progress) => {
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            progress.report({
              message: `${i + 1}/${files.length} ${vscode.workspace.asRelativePath(f)}`,
              increment: 100 / files.length,
            });

            try {
              const buf = await vscode.workspace.fs.readFile(f);
              const text = Buffer.from(buf).toString("utf-8");
              const baseName = vscode.workspace.asRelativePath(f).replace(/\.[^.]+$/g, "");
              const ext = f.fsPath.split(".").pop()?.toLowerCase();

              let format: "postman" | "openapi" = "postman";
              let data: unknown;

              try {
                data = JSON.parse(text);
                if ((data as any).openapi || (data as any).swagger) format = "openapi";
                else if ((data as any).info?._postman_id || (data as any).item) format = "postman";
              } catch {
                void vscode.window.showWarningMessage(
                  `DevPulse: ${vscode.workspace.asRelativePath(f)} is not valid JSON — skipping.`,
                );
                continue;
              }

              const result = await api.importCollection(baseName, format, data);
              imported++;
              if (result.credentialFindings && result.credentialFindings.length > 0) {
                findings += result.credentialFindings.length;
              }
            } catch (err) {
              void vscode.window.showErrorMessage(
                `DevPulse: failed to import ${vscode.workspace.asRelativePath(f)} — ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        },
      );

      if (imported > 0) {
        engagementTracker.record("collection_imported");
        engagementTracker.recordOnboardingStep("imported");
        let msg = `DevPulse: imported ${imported} collection${imported !== 1 ? "s" : ""}.`;
        if (findings > 0) {
          msg += ` ⚠ ${findings} potential credential${findings !== 1 ? "s" : ""} found — review and rotate immediately.`;
        }
        void vscode.window.showInformationMessage(msg);
        await refresh();
      } else {
        void vscode.window.showWarningMessage("DevPulse: no collections were imported.");
      }
    }),
  );

  async function updateFindingStatusCmd(node: unknown, status: FindingStatus): Promise<void> {
    engagementTracker.record("finding_status_changed");
    const findingId = extractFindingId(node);
    if (!findingId) {
      void vscode.window.showWarningMessage(
        "DevPulse: could not determine finding from selection.",
      );
      return;
    }
    try {
      await api.updateFindingStatus(findingId, status);
      await refresh();
    } catch (err) {
      void vscode.window.showErrorMessage(
        `DevPulse: could not update finding — ${errMessage(err)}`,
      );
    }
  }

  // --- lifecycle ---------------------------------------------------------

  context.subscriptions.push(
    treeView,
    autoFixTreeView,
    statusBar,
    { dispose: () => heartbeat.stop() },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("devpulse.apiUrl")) {
        void refresh();
      }
      if (
        e.affectsConfiguration("devpulse.heartbeatIntervalSec") ||
        e.affectsConfiguration("devpulse.trackFileChanges")
      ) {
        heartbeat.stop();
        heartbeat.start();
      }
    }),
  );

  await registerGatewayCommand(context, readApiKey);
  registerShadowApiCommand(context, {
    isTrusted: () => vscode.workspace.isTrusted,
  });

  // Postman credential scanner command
  const postmanImport = new PostmanImportCommand(context, api);
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.importPostman", () => postmanImport.execute()),
  );

  // Scan current file command
  const scanCurrentFile = new ScanCurrentFileCommand(api);
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.scanCurrentFile", () => {
      engagementTracker.record("scan_run");
      return scanCurrentFile.execute();
    }),
  );

  // Demo mode command
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.runDemo", async () => {
      const { runDemoScenarios } = await import("./demoMode");
      await runDemoScenarios();
      engagementTracker.record("demo_completed");
    }),
  );

  // Weekly digest command
  const weeklyDigest = new WeeklyDigestCommand(api, engagementTracker);
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.showWeeklyDigest", () => weeklyDigest.execute()),
  );

  // Feedback command
  const feedbackCmd = new FeedbackCommand(api);
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.sendFeedback", () => feedbackCmd.execute()),
  );

  // Onboarding tour
  const onboardingTour = new OnboardingTour(context, api, engagementTracker, () => {
    void vscode.window
      .showInformationMessage(
        "🎉 You're all set! DevPulse is now protecting your APIs.",
        "Open Dashboard",
      )
      .then((choice) => {
        if (choice === "Open Dashboard") {
          void vscode.commands.executeCommand("devpulse.openSecurityPanel");
        }
      });
  });
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.startOnboardingTour", () => onboardingTour.start()),
  );

  // Health check command
  const healthCheck = new HealthCheckCommand(api);
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.checkHealth", () => healthCheck.execute()),
  );
  // Auto-start tour for new users (no API key yet, and not previously dismissed)
  const tourDismissed = context.globalState.get<boolean>("devpulse.tourDismissed") ?? false;
  if (!cachedApiKey && !tourDismissed) {
    void onboardingTour.start();
  }
  // Track tour dismissal when panel closes
  onboardingTour.onDismiss(() => {
    void context.globalState.update("devpulse.tourDismissed", true);
  });

  // Onboarding nudges: check after 30 seconds if onboarding incomplete
  const onboardingTimer = setTimeout(() => {
    const progress = engagementTracker.getOnboardingProgress();
    const incomplete = progress.filter((p) => !p.complete);
    if (incomplete.length > 0) {
      const nextStep = incomplete[0];
      const messages: Record<string, string> = {
        signed_in: "Connect your DevPulse API key to start scanning.",
        imported: "Import a collection to scan your APIs.",
        scanned: "Run your first scan to find security issues.",
        found_issue: "Review your findings in the DevPulse panel.",
      };
      if (messages[nextStep.step]) {
        void vscode.window
          .showInformationMessage(`DevPulse: ${messages[nextStep.step]}`, "Get Started")
          .then((choice) => {
            if (choice === "Get Started") {
              void vscode.commands.executeCommand("devpulse.openSecurityPanel");
            }
          });
      }
    }
  }, 30000);
  context.subscriptions.push({ dispose: () => clearTimeout(onboardingTimer) });

  // Review prompt: after 7 days of active usage
  const installDate = context.globalState.get<number>("devpulse.installDate") ?? Date.now();
  void context.globalState.update("devpulse.installDate", installDate);
  const daysSinceInstall = Math.floor((Date.now() - installDate) / (24 * 60 * 60 * 1000));
  const reviewPrompted = context.globalState.get<boolean>("devpulse.reviewPrompted") ?? false;
  if (daysSinceInstall >= 7 && !reviewPrompted && engagementTracker.getScore() > 50) {
    void context.globalState.update("devpulse.reviewPrompted", true);
    void vscode.window
      .showInformationMessage(
        "Are you finding DevPulse useful? A quick review on the marketplace helps us grow.",
        "Leave Review",
        "Not Now",
      )
      .then((choice) => {
        if (choice === "Leave Review") {
          void vscode.env.openExternal(
            vscode.Uri.parse(
              "https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse&ssr=false#review-details",
            ),
          );
        }
      });
  }

  // Periodic telemetry flush every 5 minutes
  const flushInterval = setInterval(
    () => {
      void engagementTracker.flushToServer();
    },
    5 * 60 * 1000,
  );
  context.subscriptions.push({ dispose: () => clearInterval(flushInterval) });

  heartbeat.start();
}

export function deactivate(): void {
  /* lifecycle cleanup is handled via context.subscriptions */
}

function errMessage(err: unknown): string {
  if (err instanceof DevPulseApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractFindingId(node: unknown): string | null {
  if (node && typeof node === "object") {
    const maybe = node as Record<string, unknown>;
    if (
      "finding" in maybe &&
      maybe.finding &&
      typeof maybe.finding === "object" &&
      "id" in (maybe.finding as Record<string, unknown>)
    ) {
      const id = (maybe.finding as Record<string, unknown>).id;
      if (typeof id === "string") return id;
    }
    if ("id" in maybe && typeof maybe.id === "string") {
      return maybe.id;
    }
  }
  return null;
}
