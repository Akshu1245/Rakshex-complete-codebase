export type Severity = "Critical" | "High" | "Medium" | "Low";

/** Minimal finding identity used for baseline comparison. */
export interface BaselineFinding {
  /** Stable fingerprint (preferred) or ruleId|method|path. */
  fingerprint: string;
  ruleId?: string;
  severity: Severity;
  title?: string;
  status?: "open" | "resolved" | "suppressed" | "accepted";
}

export interface RiskBaseline {
  id: string;
  workspaceId: string;
  assetId: string;
  createdAt: string;
  label?: string;
  findings: BaselineFinding[];
  /** Severity counts at capture time. */
  summary: SeverityCounts;
}

export interface SeverityCounts {
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
  total: number;
}

export type RegressionKind =
  "new" | "regressed" | "resolved" | "severity_increased" | "severity_decreased" | "unchanged";

export interface FindingDelta {
  fingerprint: string;
  kind: RegressionKind;
  baseline?: BaselineFinding;
  current?: BaselineFinding;
}

export interface BaselineComparison {
  baselineId: string;
  assetId: string;
  comparedAt: string;
  deltas: FindingDelta[];
  newFindings: FindingDelta[];
  resolvedFindings: FindingDelta[];
  regressedFindings: FindingDelta[];
  severityIncreased: FindingDelta[];
  /** True if any Critical/High new or regressed finding exists. */
  failsGate: boolean;
  summary: {
    newCount: number;
    resolvedCount: number;
    regressedCount: number;
    severityIncreasedCount: number;
    unchangedCount: number;
  };
}

export interface GateOptions {
  /** Fail on any new finding of this severity or worse. Default: High. */
  failOn?: Severity;
  /** Also fail when previously resolved findings reappear. Default: true. */
  failOnRegression?: boolean;
}
