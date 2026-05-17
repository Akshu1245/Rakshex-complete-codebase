import * as vscode from "vscode";
import type { DevPulseApi, Finding, FindingStatus, Severity } from "./api";

const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];

const SEVERITY_ICON: Record<Severity, vscode.ThemeIcon> = {
  Critical: new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground")),
  High: new vscode.ThemeIcon("warning", new vscode.ThemeColor("editorWarning.foreground")),
  Medium: new vscode.ThemeIcon("info", new vscode.ThemeColor("editorInfo.foreground")),
  Low: new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("disabledForeground")),
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "● Open",
  "in-progress": "◐ In Progress",
  resolved: "✓ Resolved",
};

type FindingsNode = SeverityGroupNode | FindingNode | MessageNode;

class SeverityGroupNode {
  readonly kind = "severity" as const;
  constructor(
    readonly severity: Severity,
    readonly findings: Finding[],
  ) {}
}

class FindingNode {
  readonly kind = "finding" as const;
  constructor(readonly finding: Finding) {}
}

class MessageNode {
  readonly kind = "message" as const;
  constructor(readonly label: string) {}
}

export class FindingsTreeProvider implements vscode.TreeDataProvider<FindingsNode> {
  private readonly _onDidChange = new vscode.EventEmitter<FindingsNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private findings: Finding[] = [];
  private lastError: string | null = null;
  private signedIn = false;
  private lastFetchTime = 0;
  private readonly CACHE_MS = 8000; // 8-second cache to avoid redundant API calls

  constructor(private readonly api: DevPulseApi) {}

  setSignedIn(signedIn: boolean): void {
    this.signedIn = signedIn;
    if (!signedIn) {
      this.findings = [];
      this.lastError = null;
      this.lastFetchTime = 0;
    }
    this._onDidChange.fire();
  }

  async refresh(force = false): Promise<void> {
    if (!this.signedIn) {
      this._onDidChange.fire();
      return;
    }
    // Skip redundant fetches within cache window unless forced
    if (!force && Date.now() - this.lastFetchTime < this.CACHE_MS) {
      this._onDidChange.fire();
      return;
    }
    try {
      this.findings = await this.api.getRecentFindings(20);
      this.lastError = null;
      this.lastFetchTime = Date.now();
    } catch (err) {
      this.findings = [];
      this.lastError = err instanceof Error ? err.message : String(err);
    }
    this._onDidChange.fire();
  }

  getTreeItem(node: FindingsNode): vscode.TreeItem {
    if (node.kind === "message") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.contextValue = "message";
      return item;
    }
    if (node.kind === "severity") {
      const item = new vscode.TreeItem(
        `${node.severity} (${node.findings.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = SEVERITY_ICON[node.severity];
      item.contextValue = "severityGroup";
      item.description = `${node.findings.filter((f) => f.status === "open").length} open`;
      return item;
    }
    const f = node.finding;
    const item = new vscode.TreeItem(f.title, vscode.TreeItemCollapsibleState.None);
    item.description = `${f.collectionName} · ${STATUS_LABEL[f.status]}`;
    item.tooltip = [
      `📌 ${f.title}`,
      `Severity: ${f.severity}`,
      `Status: ${f.status}`,
      `Collection: ${f.collectionName}`,
      f.category ? `Category: ${f.category}` : null,
      `ID: ${f.id}`,
    ]
      .filter(Boolean)
      .join("\n");
    item.contextValue = "finding";
    item.iconPath = SEVERITY_ICON[f.severity];
    item.id = f.id;
    item.accessibilityInformation = {
      label: `${f.severity} finding: ${f.title}, ${f.status}`,
    };
    return item;
  }

  getFindingsSnapshot(): Finding[] {
    return this.findings;
  }

  getChildren(node?: FindingsNode): FindingsNode[] {
    if (!node) {
      if (!this.signedIn) {
        return [];
      }
      if (this.lastError) {
        // Show user-friendly error with action instead of raw error text
        const isOffline =
          this.lastError.includes("unreachable") || this.lastError.includes("timeout");
        if (isOffline) {
          return [
            new MessageNode(
              "DevPulse is temporarily unreachable. Check your connection or run 'DevPulse: Check Health'.",
            ),
          ];
        }
        return [new MessageNode(`Something went wrong: ${this.lastError}`)];
      }
      if (this.findings.length === 0) {
        return [
          new MessageNode("No findings yet. Import a collection or run a scan to get started."),
        ];
      }
      const groups: SeverityGroupNode[] = [];
      for (const sev of SEVERITY_ORDER) {
        const matches = this.findings.filter((f) => f.severity === sev);
        if (matches.length > 0) {
          groups.push(new SeverityGroupNode(sev, matches));
        }
      }
      return groups;
    }
    if (node.kind === "severity") {
      return node.findings.map((f) => new FindingNode(f));
    }
    return [];
  }
}
