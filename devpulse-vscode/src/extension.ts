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
import { AnalyticsDashboard } from "./analyticsDashboard";
import { RetentionEngine } from "./retentionEngine";
import { dismissFinding } from "./dismissFinding";
import { maybeInstallMock } from "./mockServerActivation";

const SECRET_API_KEY = "devpulse.apiKey";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let cachedApiKey: string | undefined;
  const readApiKey = () => cachedApiKey;

  // Mock mode: intercept all HTTP calls at the fetch boundary (no real backend needed).
  // Activated by devpulse.mockMode: true in settings or DEVPULSE_MOCK=true env var.
  const uninstallMock = maybeInstallMock(context);
  if (uninstallMock) context.subscriptions.push({ dispose: uninstallMock });

  const api = new DevPulseApi(getConfiguredBaseUrl, readApiKey);
  const findingsProvider = new FindingsTreeProvider(api, context);
  const autoFixProvider = new AutoFixTreeProvider(api);
  const valueTracker = new ValueMomentTracker(context);
  const engagementTracker = new EngagementTracker(context, api);
  const retentionEngine = new RetentionEngine(context, engagementTracker);
  const statusBar = new DevPulseStatusBar(api, () => engagementTracker.getScanStreak());
  const heartbeat = new HeartbeatService(api, () => Boolean(cachedApiKey));

  engagementTracker.recordOnboardingStep("installed");

  cachedApiKey = await context.secrets.get(SECRET_API_KEY);

  // Add heartbeat to subscriptions so it gets cleaned up on deactivation
  context.subscriptions.push(heartbeat);

  // Stale state recovery: refresh when window regains focus (network may have recovered)
  const windowStateDisposable = vscode.window.onDidChangeWindowState(async (e) => {
    if (e.focused && cachedApiKey) {
      const lastActive = context.globalState.get<number>("devpulse.lastActive") ?? Date.now();
      const minutesAway = (Date.now() - lastActive) / (60 * 1000);
      // If user was away > 10 minutes, silently refresh to pick up any new findings
      if (minutesAway > 10) {
        try {
          await refresh(false); // respect cache — will still refresh if cache expired
        } catch {
          // Silently fail — stale state recovery is best-effort
        }
      }
      void context.globalState.update("devpulse.lastActive", Date.now());
    }
  });
  context.subscriptions.push(windowStateDisposable);

  const treeView = vscode.window.createTreeView("devpulse.findings", {
    treeDataProvider: findingsProvider,
    showCollapseAll: true,
  });

  // Persist tree expand/collapse state for severity groups
  const expandedKeys = new Set<string>(
    context.globalState.get<string[]>("devpulse.expandedSeverityGroups") ?? [],
  );
  treeView.onDidExpandElement((e) => {
    if ((e.element as any).kind === "severity") {
      expandedKeys.add((e.element as any).severity);
      void context.globalState.update("devpulse.expandedSeverityGroups", Array.from(expandedKeys));
    }
  });
  treeView.onDidCollapseElement((e) => {
    if ((e.element as any).kind === "severity") {
      expandedKeys.delete((e.element as any).severity);
      void context.globalState.update("devpulse.expandedSeverityGroups", Array.from(expandedKeys));
    }
  });

  const autoFixTreeView = vscode.window.createTreeView("devpulse.autofix", {
    treeDataProvider: autoFixProvider,
    showCollapseAll: true,
  });

  let refreshInFlight = false;
  const refresh = async (force = false) => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      await Promise.all([
        findingsProvider.refresh(force),
        autoFixProvider.refresh(force),
        statusBar.refresh(Boolean(cachedApiKey)),
      ]);
      // Track potential value moments after scan
      const findings = findingsProvider.getFindingsSnapshot?.() ?? [];
      const secrets = findings.filter(
        (f: { severity: string }) => f.severity === "Critical",
      ).length;
      const high = findings.filter((f: { severity: string }) => f.severity === "High").length;
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
      // Workflow continuity: gentle reminder for stale unresolved findings
      const openCritical = findings.filter(
        (f) => f.severity === "Critical" && f.status === "open",
      ).length;
      const openHigh = findings.filter((f) => f.severity === "High" && f.status === "open").length;
      if (openCritical > 0 || openHigh > 0) {
        const total = openCritical + openHigh;
        const lastReminded =
          context.globalState.get<number>("devpulse.lastContinuityReminder") ?? 0;
        const hoursSince = (Date.now() - lastReminded) / (1000 * 60 * 60);
        if (hoursSince >= 24) {
          dedupedShowMessage(
            `You have ${total} unresolved ${openCritical > 0 ? "critical" : "high"}-severity finding${total !== 1 ? "s" : ""}. A quick review keeps your APIs safer.`,
            "info",
          );
          void context.globalState.update("devpulse.lastContinuityReminder", Date.now());
        }
      }
    } catch (err) {
      // Calm recovery: show once, guide user gently
      statusBar.showError("Could not refresh data — will retry automatically");
      dedupedShowMessage("DevPulse: Refresh delayed. Retrying in a moment.", "warn");
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

  // Don't block activation on refresh — fire-and-forget
  void applySignedInState(Boolean(cachedApiKey));

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
            `Connected as ${result.user.email ?? result.user.name ?? "user"} (${result.user.plan}).`,
          );
        }
      } catch (err) {
        const msg =
          err instanceof DevPulseApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        void vscode.window.showErrorMessage(`Couldn't verify that API key — ${msg}`);
        return;
      }

      if (!valid) {
        void vscode.window.showErrorMessage(
          "That API key didn't work. Generate a fresh one from your DevPulse dashboard.",
        );
        return;
      }

      await context.secrets.store(SECRET_API_KEY, apiKey);
      cachedApiKey = apiKey;
      engagementTracker.recordOnboardingStep("signed_in");
      await applySignedInState(true);
    },
    handleQuickAction,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WelcomeViewProvider.viewType, welcomeProvider),
  );

  // --- commands ----------------------------------------------------------

  const analyticsDashboard = new AnalyticsDashboard(context, engagementTracker);

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
        void vscode.window.showErrorMessage(`Couldn't verify that API key — ${msg}`);
        return;
      }

      if (!valid) {
        void vscode.window.showErrorMessage(
          "That API key didn't work. Generate a fresh one from your DevPulse dashboard.",
        );
        return;
      }

      await context.secrets.store(SECRET_API_KEY, key);
      cachedApiKey = key;
      engagementTracker.recordOnboardingStep("signed_in");
      await applySignedInState(true);
    }),

    vscode.commands.registerCommand("devpulse.signOut", async () => {
      await context.secrets.delete(SECRET_API_KEY);
      cachedApiKey = undefined;
      await applySignedInState(false);
      void vscode.window.showInformationMessage("Signed out of DevPulse.");
    }),

    vscode.commands.registerCommand("devpulse.refresh", async () => {
      await refresh(true);
    }),

    vscode.commands.registerCommand("devpulse.toggleCompactMode", () => {
      findingsProvider.toggleCompactMode();
      const mode = findingsProvider.isCompact() ? "compact" : "expanded";
      void vscode.window.showInformationMessage(`Findings view: ${mode} mode.`);
    }),

    vscode.commands.registerCommand("devpulse.showCritical", () => {
      findingsProvider.setSeverityFilter("Critical");
    }),
    vscode.commands.registerCommand("devpulse.showHigh", () => {
      findingsProvider.setSeverityFilter("High");
    }),
    vscode.commands.registerCommand("devpulse.showMedium", () => {
      findingsProvider.setSeverityFilter("Medium");
    }),
    vscode.commands.registerCommand("devpulse.showLow", () => {
      findingsProvider.setSeverityFilter("Low");
    }),
    vscode.commands.registerCommand("devpulse.clearSeverityFilter", () => {
      findingsProvider.setSeverityFilter(null);
    }),

    vscode.commands.registerCommand("devpulse.openDashboard", async () => {
      const base = getConfiguredBaseUrl().replace(/\/+$/, "");
      void vscode.env.openExternal(vscode.Uri.parse(base));
    }),

    vscode.commands.registerCommand("devpulse.runScan", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Connect your API key to use this feature.");
        return;
      }
      let collections: { id: string; name: string }[] = [];
      try {
        collections = await api.listCollections();
      } catch (err) {
        void vscode.window.showErrorMessage(`Couldn't load collections — ${errMessage(err)}`);
        return;
      }
      if (collections.length === 0) {
        void vscode.window.showInformationMessage(
          "No collections found. Create one from your DevPulse dashboard and try again.",
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
        void context.globalState.update("devpulse.lastScannedCollection", picked.collectionId);
        void vscode.window.showInformationMessage(
          `Scanning "${picked.label}" — results will appear in the Findings panel.`,
        );
        engagementTracker.record("scan_run");
        engagementTracker.recordOnboardingStep("scanned");
        await refresh(true);
      } catch (err) {
        void vscode.window.showErrorMessage(`Scan didn't complete — ${errMessage(err)}`);
      }
    }),

    vscode.commands.registerCommand("devpulse.rerunLastScan", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Connect your API key to use this feature.");
        return;
      }
      const lastId = context.globalState.get<string>("devpulse.lastScannedCollection");
      if (!lastId) {
        void vscode.window.showWarningMessage("Run a scan first, then you can rerun it quickly.");
        return;
      }
      try {
        await api.triggerScan(lastId);
        void vscode.window.showInformationMessage(
          "Rerunning last scan — results will appear shortly.",
        );
        engagementTracker.record("scan_run");
        await refresh(true);
      } catch (err) {
        void vscode.window.showErrorMessage(`Scan didn't complete — ${errMessage(err)}`);
      }
    }),

    vscode.commands.registerCommand("devpulse.markFindingResolved", async (node: unknown) =>
      updateFindingStatusCmd(node, "resolved"),
    ),
    vscode.commands.registerCommand(
      "devpulse.markSelectedResolved",
      async (node: unknown, selected: unknown[]) => {
        const items = Array.isArray(selected) ? selected : [node];
        const targets = items.filter(
          (n) => n && typeof n === "object" && (n as any).kind === "finding",
        );
        if (targets.length === 0) {
          void vscode.window.showWarningMessage("Select findings to resolve.");
          return;
        }
        let resolved = 0;
        for (const target of targets) {
          try {
            const id = extractFindingId(target);
            if (id) {
              await api.updateFindingStatus(id, "resolved");
              resolved++;
            }
          } catch {
            // Continue with others
          }
        }
        engagementTracker.record("finding_status_changed");
        await refresh(true);
        const remaining = findingsProvider
          .getFindingsSnapshot()
          .filter(
            (f) => f.status === "open" && (f.severity === "Critical" || f.severity === "High"),
          ).length;
        const msg =
          remaining > 0
            ? `Resolved ${resolved} finding${resolved !== 1 ? "s" : ""}. ${remaining} critical/high still open — keep going!`
            : `Resolved ${resolved} finding${resolved !== 1 ? "s" : ""}. All critical and high issues are cleared — great work!`;
        dedupedShowMessage(msg, "info");
      },
    ),
    vscode.commands.registerCommand("devpulse.markFindingInProgress", async (node: unknown) =>
      updateFindingStatusCmd(node, "in-progress"),
    ),
    vscode.commands.registerCommand("devpulse.openSecurityPanel", () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Connect your API key to use this feature.");
        return;
      }
      engagementTracker.record("dashboard_opened");
      SecurityWebviewPanel.createOrShow(context.extensionUri, api, context);
    }),

    vscode.commands.registerCommand("devpulse.openSettings", () => {
      SettingsWebviewPanel.createOrShow(context.extensionUri, api, readApiKey, context);
    }),

    vscode.commands.registerCommand("devpulse.askSecurityCopilot", () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Connect your API key to use this feature.");
        return;
      }
      CopilotViewPanel.createOrShow(context.extensionUri, api);
    }),

    vscode.commands.registerCommand("devpulse.generateApiKey", async () => {
      if (!cachedApiKey) {
        void vscode.window.showWarningMessage("Connect your API key first.");
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
        void vscode.window.showInformationMessage("New API key generated and copied to clipboard.");
      } catch (err) {
        void vscode.window.showErrorMessage(`Couldn't generate API key — ${errMessage(err)}`);
      }
    }),

    // Auto-fix: Apply Fix — insert suggested code into active editor or copy to clipboard
    vscode.commands.registerCommand("devpulse.applyAutoFix", async (node: unknown) => {
      const suggestion = extractSuggestionFromNode(node);
      if (!suggestion) {
        void vscode.window.showWarningMessage("No auto-fix suggestion found for this item.");
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
          `Fix for "${suggestion.title}" inserted at cursor.`,
        );
      } else {
        // Fallback: copy to clipboard if no editor is open
        await vscode.env.clipboard.writeText(suggestion.code);
        void vscode.window.showInformationMessage(
          `Fix code for "${suggestion.title}" copied to clipboard.`,
        );
      }
    }),

    // Auto-fix: Dismiss
    vscode.commands.registerCommand("devpulse.dismissAutoFix", async (node: unknown) => {
      const suggestion = extractSuggestionFromNode(node);
      if (!suggestion) {
        void vscode.window.showWarningMessage("No auto-fix suggestion found for this item.");
        return;
      }
      autoFixProvider.dismiss(suggestion.id);
      void vscode.window.showInformationMessage(`Dismissed suggestion "${suggestion.title}".`);
    }),

    // Copy Finding ID
    vscode.commands.registerCommand("devpulse.copyFindingId", async (node: unknown) => {
      const findingId = extractFindingId(node);
      if (!findingId) {
        void vscode.window.showWarningMessage(
          "Couldn't identify that finding. Try selecting it from the Findings panel.",
        );
        return;
      }
      await vscode.env.clipboard.writeText(findingId);
      void vscode.window.showInformationMessage(`Finding ID copied to clipboard.`);
    }),

    // Open in Dashboard
    vscode.commands.registerCommand("devpulse.openFindingInDashboard", async (node: unknown) => {
      const findingId = extractFindingId(node);
      if (!findingId) {
        void vscode.window.showWarningMessage(
          "Couldn't identify that finding. Try selecting it from the Findings panel.",
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
                `Failed to import ${vscode.workspace.asRelativePath(f)} — ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        },
      );

      if (imported > 0) {
        engagementTracker.record("collection_imported");
        engagementTracker.recordOnboardingStep("imported");
        let msg = `Imported ${imported} collection${imported !== 1 ? "s" : ""}.`;
        if (findings > 0) {
          msg += ` ${findings} potential credential${findings !== 1 ? "s" : ""} found. Review them in the Findings panel.`;
        }
        void vscode.window.showInformationMessage(msg);
        await refresh(true);
      } else {
        void vscode.window.showWarningMessage("No collections were imported.");
      }
    }),

    // Onboarding funnel analytics dashboard
    vscode.commands.registerCommand("devpulse.openOnboardingAnalytics", () => {
      engagementTracker.record("dashboard_opened");
      analyticsDashboard.show();
    }),

    // Dismiss finding with reason picker (false-positive tracking)
    vscode.commands.registerCommand("devpulse.dismissFinding", async (node: unknown) => {
      const findingId = extractFindingId(node);
      if (!findingId) {
        void vscode.window.showWarningMessage(
          "Couldn't identify that finding. Try selecting it from the Findings panel.",
        );
        return;
      }
      const reason = await vscode.window.showQuickPick(
        ["False Positive", "Not Reproducible", "Intended Behavior", "Other"],
        { placeHolder: "Why are you dismissing this finding?" },
      );
      if (!reason) return;
      retentionEngine.recordDismissal(reason);
      const details = await vscode.window.showInputBox({
        prompt: "Optional: Add more details about why you are dismissing this finding.",
      });
      try {
        await api.updateFindingStatus(findingId, "resolved");
        engagementTracker.record("finding_status_changed");
        await refresh(true);
        void vscode.window.showInformationMessage(`Finding dismissed (${reason}).`);
      } catch (err) {
        void vscode.window.showErrorMessage(`Couldn't dismiss finding — ${errMessage(err)}`);
      }
    }),
  );

  async function updateFindingStatusCmd(node: unknown, status: FindingStatus): Promise<void> {
    engagementTracker.record("finding_status_changed");
    const findingId = extractFindingId(node);
    if (!findingId) {
      void vscode.window.showWarningMessage(
        "Couldn't identify that finding. Try selecting it from the Findings panel.",
      );
      return;
    }
    try {
      await api.updateFindingStatus(findingId, status);
      await refresh(true);
    } catch (err) {
      void vscode.window.showErrorMessage(`Couldn't update finding — ${errMessage(err)}`);
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
        void refresh().catch(() => {
          statusBar.showError("Could not refresh data — will retry automatically");
        });
      }
      if (
        e.affectsConfiguration("devpulse.heartbeatIntervalSec") ||
        e.affectsConfiguration("devpulse.trackFileChanges")
      ) {
        try {
          heartbeat.stop();
          heartbeat.start();
        } catch {
          statusBar.showError("Heartbeat restart failed — will retry automatically");
        }
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
  const weeklyDigest = new WeeklyDigestCommand(api, engagementTracker, context);
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
  // Auto-start tour for new users after a brief delay so the UI feels settled
  const tourDismissed = context.globalState.get<boolean>("devpulse.tourDismissed") ?? false;
  if (!cachedApiKey && !tourDismissed) {
    const tourDelay = setTimeout(() => {
      void onboardingTour.start();
    }, 1500);
    context.subscriptions.push({ dispose: () => clearTimeout(tourDelay) });
  }
  // Track tour dismissal when panel closes
  onboardingTour.onDismiss(() => {
    void context.globalState.update("devpulse.tourDismissed", true);
  });

  // Retention nudges: celebrate habit milestones
  const retentionTimer = setTimeout(() => {
    const streak = engagementTracker.getScanStreak();
    if (streak === 3) {
      void vscode.window.showInformationMessage(
        "🔥 3-day scan streak — you're building a solid security habit.",
      );
    } else if (streak === 7) {
      void vscode.window.showInformationMessage(
        "🎯 7-day scan streak — DevPulse is now part of your workflow.",
      );
    }
  }, 10000);
  context.subscriptions.push({ dispose: () => clearTimeout(retentionTimer) });

  // Onboarding nudges: gentle reminder after 90 seconds if onboarding incomplete.
  // Guard with isOnboardingComplete() first — clean-repo users who have completed
  // all 4 core steps (installed, signed_in, imported, scanned) are fully onboarded
  // even if `found_issue` has not fired (value-moment signal, not a required step).
  const onboardingTimer = setTimeout(() => {
    if (engagementTracker.isOnboardingComplete()) return; // already done — no nudge
    const progress = engagementTracker.getOnboardingProgress();
    // Only nudge for the 4 core steps — exclude found_issue (value-moment, not gating)
    const coreSteps = ["installed", "signed_in", "imported", "scanned"];
    const incomplete = progress.filter((p) => coreSteps.includes(p.step) && !p.complete);
    if (incomplete.length > 0) {
      const nextStep = incomplete[0];
      const messages: Record<string, string> = {
        signed_in: "Connect your API key when you're ready.",
        imported: "Import a collection to start scanning.",
        scanned: "Run a scan to discover security issues.",
      };
      if (messages[nextStep.step]) {
        void vscode.window
          .showInformationMessage(messages[nextStep.step], "Get Started")
          .then((choice) => {
            if (choice === "Get Started") {
              void vscode.commands.executeCommand("devpulse.openSecurityPanel");
            }
          });
      }
    }
  }, 90000);
  context.subscriptions.push({ dispose: () => clearTimeout(onboardingTimer) });

  // Review prompt: after 7 days of active usage (defer so it doesn't slow startup)
  const reviewTimer = setTimeout(() => {
    const installDate = context.globalState.get<number>("devpulse.installDate") ?? Date.now();
    void context.globalState.update("devpulse.installDate", installDate);
    const daysSinceInstall = Math.floor((Date.now() - installDate) / (24 * 60 * 60 * 1000));
    const reviewPrompted = context.globalState.get<boolean>("devpulse.reviewPrompted") ?? false;
    if (daysSinceInstall >= 7 && !reviewPrompted && engagementTracker.getScore() > 50) {
      void context.globalState.update("devpulse.reviewPrompted", true);
      void vscode.window
        .showInformationMessage(
          "Enjoying DevPulse? A quick review helps other developers discover it.",
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
  }, 5000);
  context.subscriptions.push({ dispose: () => clearTimeout(reviewTimer) });

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

const recentMessages = new Map<string, number>();
function dedupedShowMessage(message: string, type: "info" | "warn" | "error" = "info"): void {
  const last = recentMessages.get(message);
  const now = Date.now();
  if (last && now - last < 3000) return; // skip duplicates within 3s
  recentMessages.set(message, now);
  if (type === "info") void vscode.window.showInformationMessage(message);
  else if (type === "warn") void vscode.window.showWarningMessage(message);
  else void vscode.window.showErrorMessage(message);
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
