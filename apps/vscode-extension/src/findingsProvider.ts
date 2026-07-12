import * as vscode from "vscode";
import type { RakshexApi, Finding, FindingStatus, Severity } from "./api";

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

const REMEDIATION_HINTS: Record<string, string> = {
  "Broken Authentication": "Review auth flow and enforce token expiration.",
  "Sensitive Data Exposure": "Encrypt data in transit and at rest.",
  Injection: "Use parameterized queries and validate input.",
  "Security Misconfiguration": "Harden default configs and disable unused features.",
  "Insecure Deserialization": "Validate serialized data before parsing.",
  "XML External Entities": "Disable XXE in XML parsers.",
  "Access Control": "Enforce least-privilege access checks.",
  "Cross-Site Scripting": "Sanitize output and use CSP headers.",
  "Insecure Dependencies": "Update vulnerable packages and audit regularly.",
  default: "Review the finding details and apply a fix.",
};

function getRemediationHint(category: string | null): string | undefined {
  if (!category) return undefined;
  return REMEDIATION_HINTS[category] ?? REMEDIATION_HINTS.default;
}

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
  private compactMode = false;
  private severityFilter: Severity | null = null;
  private expandedSeverityGroups = new Set<string>();

  constructor(
    private readonly api: RakshexApi,
    private readonly context?: vscode.ExtensionContext,
  ) {
    if (context) {
      this.compactMode = context.globalState.get<boolean>("rakshex.compactMode") ?? false;
      this.severityFilter =
        context.globalState.get<Severity | null>("rakshex.severityFilter") ?? null;
      const expanded = context.globalState.get<string[]>("rakshex.expandedSeverityGroups") ?? [];
      this.expandedSeverityGroups = new Set(expanded);
    }
  }

  toggleCompactMode(): void {
    this.compactMode = !this.compactMode;
    void this.context?.globalState.update("rakshex.compactMode", this.compactMode);
    this._onDidChange.fire();
  }

  isCompact(): boolean {
    return this.compactMode;
  }

  setSeverityFilter(severity: Severity | null): void {
    this.severityFilter = severity;
    void this.context?.globalState.update("rakshex.severityFilter", severity);
    this._onDidChange.fire();
  }

  getSeverityFilter(): Severity | null {
    return this.severityFilter;
  }

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
      const isExpanded = this.expandedSeverityGroups.has(node.severity);
      const item = new vscode.TreeItem(
        `${node.severity} (${node.findings.length})`,
        isExpanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = SEVERITY_ICON[node.severity];
      item.contextValue = "severityGroup";
      item.description = `${node.findings.filter((f) => f.status === "open").length} open`;
      return item;
    }
    const f = node.finding;
    const item = new vscode.TreeItem(f.title, vscode.TreeItemCollapsibleState.None);
    const remediationHint = getRemediationHint(f.category);
    if (this.compactMode) {
      item.description = `${f.severity} · ${STATUS_LABEL[f.status]}`;
      item.tooltip = `${f.title}\n${f.severity} · ${f.status}${remediationHint ? "\n\n💡 " + remediationHint : ""}`;
    } else {
      item.description = `${f.collectionName} · ${STATUS_LABEL[f.status]}`;
      item.tooltip = [
        `${f.title}`,
        `Severity: ${f.severity}`,
        `Status: ${f.status}`,
        `Collection: ${f.collectionName}`,
        f.category ? `Category: ${f.category}` : null,
        `ID: ${f.id}`,
        remediationHint ? `\n💡 Suggestion: ${remediationHint}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    item.contextValue = "finding";
    item.iconPath = SEVERITY_ICON[f.severity];
    item.id = f.id;
    if (f.status !== "resolved") {
      item.command = {
        command: "rakshex.markFindingResolved",
        title: "Resolve",
        arguments: [node],
      };
    }
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
              "Rakshex is temporarily unreachable. Check your connection or run 'Rakshex: Check Health'.",
            ),
          ];
        }
        return [new MessageNode(`Something went wrong: ${this.lastError}`)];
      }
      if (this.findings.length === 0) {
        return [
          new MessageNode(
            "All clear — no security issues found. Run a scan to check again, or your APIs are in great shape.",
          ),
        ];
      }
      const groups: SeverityGroupNode[] = [];
      for (const sev of SEVERITY_ORDER) {
        if (this.severityFilter && sev !== this.severityFilter) continue;
        const matches = this.findings
          .filter((f) => f.severity === sev)
          .sort((a, b) => {
            // Within severity: open first, then in-progress, then resolved
            const statusOrder = { open: 0, "in-progress": 1, resolved: 2 };
            return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
          });
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
