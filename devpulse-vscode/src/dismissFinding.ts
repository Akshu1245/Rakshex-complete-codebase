import * as vscode from "vscode";
import type { DevPulseApi } from "./api";
import type { EngagementTracker } from "./engagementTracker";
import type { FindingsTreeProvider } from "./findingsProvider";

export async function dismissFinding(
  finding: FindingItem,
  api: DevPulseApi,
  findingsProvider: FindingsTreeProvider,
  engagementTracker: EngagementTracker,
): Promise<void> {
  if (!finding?.id) {
    vscode.window.showWarningMessage("Select a finding to dismiss.");
    return;
  }

  const reasons = [
    { label: "$(circle-slash) False positive — this is not a real issue", value: "false_positive" },
    { label: "$(check) Already fixed — I resolved this", value: "already_fixed" },
    { label: "$(dash) Not relevant — doesn't apply to my setup", value: "not_relevant" },
    { label: "$(lock) Intentional — I meant to do this", value: "intentional" },
    { label: "$(edit) Other — let me explain…", value: "other" },
  ];

  const picked = await vscode.window.showQuickPick(reasons, {
    placeHolder: "Why are you dismissing this finding?",
    title: "Dismiss Finding",
  });

  if (!picked) return;

  let detail = "";
  if (picked.value === "other") {
    detail =
      (await vscode.window.showInputBox({
        prompt: "Briefly explain why you're dismissing this finding",
        placeHolder: "e.g., This is a test key, not production",
      })) ?? "";
  }

  try {
    // Mark as resolved on the server with dismissal context
    await api.updateFindingStatus(finding.id, "resolved");

    // Track locally for trust learning
    const dismissed = (vscode.workspace
      .getConfiguration("devpulse")
      .get<unknown[]>("dismissedFindings") ?? []) as unknown[];
    dismissed.push({
      id: finding.id,
      reason: picked.value,
      detail,
      timestamp: Date.now(),
      title: finding.label,
    });
    await vscode.workspace
      .getConfiguration("devpulse")
      .update("dismissedFindings", dismissed, true);

    // Telemetry — track dismissal as engagement event
    engagementTracker.record("finding_status_changed");

    // Refresh tree
    await findingsProvider.refresh();

    vscode.window.showInformationMessage(
      `Finding dismissed. Your feedback helps improve scan accuracy.`,
      "Got it",
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Could not dismiss finding: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

interface FindingItem {
  id?: string;
  label: string;
  severity?: string;
  collectionId?: string;
}
