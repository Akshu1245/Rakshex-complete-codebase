/**
 * Auto-fix Suggestions Tree Provider.
 *
 * Groups auto-fix suggestions by finding, showing title, description,
 * and confidence level. Context menu allows "Apply Fix" (copies code
 * to clipboard) and "Dismiss".
 */
import * as vscode from "vscode";
import type { DevPulseApi, Finding, Severity } from "./api";

type ConfidenceLevel = "high" | "medium" | "low";

interface AutoFixSuggestion {
  id: string;
  findingId: string;
  findingTitle: string;
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  code: string;
  severity: Severity;
}

type AutoFixNode = FindingGroupNode | SuggestionNode | MessageNode;

class FindingGroupNode {
  readonly kind = "findingGroup" as const;
  constructor(
    readonly findingId: string,
    readonly findingTitle: string,
    readonly severity: Severity,
    readonly suggestions: AutoFixSuggestion[],
  ) {}
}

class SuggestionNode {
  readonly kind = "suggestion" as const;
  constructor(readonly suggestion: AutoFixSuggestion) {}
}

class MessageNode {
  readonly kind = "message" as const;
  constructor(readonly label: string) {}
}

const CONFIDENCE_ICON: Record<ConfidenceLevel, vscode.ThemeIcon> = {
  high: new vscode.ThemeIcon("check-all", new vscode.ThemeColor("terminal.ansiGreen")),
  medium: new vscode.ThemeIcon("check", new vscode.ThemeColor("editorWarning.foreground")),
  low: new vscode.ThemeIcon("circle-dashed", new vscode.ThemeColor("disabledForeground")),
};

const SEVERITY_ICON: Record<Severity, vscode.ThemeIcon> = {
  Critical: new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground")),
  High: new vscode.ThemeIcon("warning", new vscode.ThemeColor("editorWarning.foreground")),
  Medium: new vscode.ThemeIcon("info", new vscode.ThemeColor("editorInfo.foreground")),
  Low: new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("disabledForeground")),
};

export class AutoFixTreeProvider implements vscode.TreeDataProvider<AutoFixNode> {
  private readonly _onDidChange = new vscode.EventEmitter<AutoFixNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private suggestions: AutoFixSuggestion[] = [];
  private dismissed = new Set<string>();
  private signedIn = false;

  constructor(private readonly api: DevPulseApi) {}

  setSignedIn(signedIn: boolean): void {
    this.signedIn = signedIn;
    if (!signedIn) {
      this.suggestions = [];
      this.dismissed.clear();
    }
    this._onDidChange.fire();
  }

  dismiss(suggestionId: string): void {
    this.dismissed.add(suggestionId);
    this._onDidChange.fire();
  }

  async refresh(_force = false): Promise<void> {
    if (!this.signedIn) {
      this._onDidChange.fire();
      return;
    }
    try {
      const findings = await this.api.getRecentFindings(20);
      this.suggestions = generateAutoFixSuggestions(findings);
      this.dismissed.clear();
    } catch {
      this.suggestions = [];
    }
    this._onDidChange.fire();
  }

  getTreeItem(node: AutoFixNode): vscode.TreeItem {
    if (node.kind === "message") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.contextValue = "message";
      return item;
    }
    if (node.kind === "findingGroup") {
      const item = new vscode.TreeItem(node.findingTitle, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = SEVERITY_ICON[node.severity];
      item.description = `${node.suggestions.length} fix${node.suggestions.length !== 1 ? "es" : ""}`;
      item.contextValue = "findingGroup";
      return item;
    }
    const s = node.suggestion;
    const item = new vscode.TreeItem(s.title, vscode.TreeItemCollapsibleState.None);
    item.description = `${s.confidence} confidence`;
    item.iconPath = CONFIDENCE_ICON[s.confidence];
    item.tooltip = [
      s.title,
      `Confidence: ${s.confidence}`,
      s.description,
      "",
      "Suggested fix:",
      s.code.slice(0, 200),
    ].join("\n");
    item.contextValue = "autoFixSuggestion";
    return item;
  }

  getChildren(node?: AutoFixNode): AutoFixNode[] {
    if (!node) {
      if (!this.signedIn) {
        return [];
      }
      const active = this.suggestions.filter((s) => !this.dismissed.has(s.id));
      if (active.length === 0) {
        return [new MessageNode("No auto-fix suggestions available.")];
      }
      // Group by findingId
      const groups = new Map<string, AutoFixSuggestion[]>();
      for (const s of active) {
        const existing = groups.get(s.findingId) ?? [];
        existing.push(s);
        groups.set(s.findingId, existing);
      }
      const nodes: AutoFixNode[] = [];
      for (const [findingId, suggestions] of groups) {
        const first = suggestions[0];
        nodes.push(
          new FindingGroupNode(findingId, first.findingTitle, first.severity, suggestions),
        );
      }
      return nodes;
    }
    if (node.kind === "findingGroup") {
      return node.suggestions.map((s) => new SuggestionNode(s));
    }
    return [];
  }
}

/**
 * Generate auto-fix suggestions based on findings.
 * These are template-based suggestions derived from finding title/severity patterns.
 */
function generateAutoFixSuggestions(findings: Finding[]): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];
  for (const f of findings) {
    const titleLower = f.title.toLowerCase();

    // SQL Injection fixes
    if (titleLower.includes("sql") && titleLower.includes("inject")) {
      suggestions.push({
        id: `${f.id}-sql-param`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Use parameterized queries",
        description:
          "Replace string concatenation with parameterized queries to prevent SQL injection.",
        confidence: "high" as ConfidenceLevel,
        code: `// Before (vulnerable)\nconst query = "SELECT * FROM users WHERE id = " + userId;\n\n// After (parameterized)\nconst query = "SELECT * FROM users WHERE id = $1";\ndb.query(query, [userId]);`,
        severity: f.severity,
      });
    }

    // XSS fixes
    if (
      titleLower.includes("xss") ||
      (titleLower.includes("cross-site") && titleLower.includes("script"))
    ) {
      suggestions.push({
        id: `${f.id}-xss-encode`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Encode output / sanitize input",
        description:
          "Use context-aware output encoding and input sanitization to prevent XSS attacks.",
        confidence: "high" as ConfidenceLevel,
        code: `// Use DOMPurify or similar library\nimport DOMPurify from 'dompurify';\nconst clean = DOMPurify.sanitize(userInput);\nelement.innerHTML = clean;`,
        severity: f.severity,
      });
    }

    // Auth/Token fixes
    if (titleLower.includes("auth") || titleLower.includes("token") || titleLower.includes("jwt")) {
      suggestions.push({
        id: `${f.id}-auth-validate`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Validate and verify tokens server-side",
        description: "Ensure all authentication tokens are validated server-side on every request.",
        confidence: "high" as ConfidenceLevel,
        code: `// Verify JWT on every request\nconst decoded = jwt.verify(token, process.env.JWT_SECRET, {\n  algorithms: ['HS256'],\n  issuer: 'your-app',\n});`,
        severity: f.severity,
      });
    }

    // CORS fixes
    if (titleLower.includes("cors")) {
      suggestions.push({
        id: `${f.id}-cors-restrict`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Restrict CORS origins",
        description: "Replace wildcard (*) with specific allowed origins.",
        confidence: "medium" as ConfidenceLevel,
        code: `// Before\napp.use(cors({ origin: '*' }));\n\n// After\napp.use(cors({\n  origin: ['https://your-app.com', 'https://admin.your-app.com'],\n  credentials: true,\n}));`,
        severity: f.severity,
      });
    }

    // Rate limiting
    if (
      titleLower.includes("rate") ||
      titleLower.includes("limit") ||
      titleLower.includes("throttl")
    ) {
      suggestions.push({
        id: `${f.id}-rate-limit`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Implement rate limiting",
        description: "Add rate limiting middleware to prevent abuse.",
        confidence: "medium" as ConfidenceLevel,
        code: `import rateLimit from 'express-rate-limit';\n\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100, // limit each IP to 100 requests per windowMs\n  standardHeaders: true,\n  legacyHeaders: false,\n});\napp.use(limiter);`,
        severity: f.severity,
      });
    }

    // PII / Data exposure
    if (
      titleLower.includes("pii") ||
      titleLower.includes("data exposure") ||
      titleLower.includes("sensitive")
    ) {
      suggestions.push({
        id: `${f.id}-pii-mask`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Mask sensitive data in responses",
        description: "Remove or mask PII and sensitive fields from API responses.",
        confidence: "high" as ConfidenceLevel,
        code: `// Mask sensitive fields before sending response\nfunction maskSensitive(data) {\n  return {\n    ...data,\n    email: data.email?.replace(/(.{2}).+(@.+)/, '$1***$2'),\n    phone: data.phone?.replace(/\\d(?=\\d{4})/g, '*'),\n    ssn: '***-**-' + data.ssn?.slice(-4),\n  };\n}`,
        severity: f.severity,
      });
    }

    // Generic suggestion for any finding without specific patterns
    if (suggestions.filter((s) => s.findingId === f.id).length === 0) {
      suggestions.push({
        id: `${f.id}-review`,
        findingId: f.id,
        findingTitle: f.title,
        title: "Review and remediate finding",
        description: `Review this ${f.severity.toLowerCase()} severity finding and apply appropriate security controls.`,
        confidence:
          f.severity === "Critical" || f.severity === "High"
            ? ("medium" as ConfidenceLevel)
            : ("low" as ConfidenceLevel),
        code: `// TODO: Remediate finding: ${f.title}\n// Review the affected endpoint and apply security best practices.\n// Consider input validation, authentication checks, and least-privilege access.`,
        severity: f.severity,
      });
    }
  }
  return suggestions;
}

/**
 * Extract the suggestion object from a tree node for command handling.
 */
export function extractSuggestionFromNode(node: unknown): AutoFixSuggestion | null {
  if (node && typeof node === "object") {
    const maybe = node as Record<string, unknown>;
    if ("suggestion" in maybe && maybe.suggestion && typeof maybe.suggestion === "object") {
      return maybe.suggestion as AutoFixSuggestion;
    }
  }
  return null;
}

/**
 * Extract the finding group node ID for dismiss-all operations.
 */
export function extractFindingGroupFromNode(node: unknown): string | null {
  if (node && typeof node === "object") {
    const maybe = node as Record<string, unknown>;
    if ("findingId" in maybe && typeof maybe.findingId === "string") {
      return maybe.findingId;
    }
  }
  return null;
}
