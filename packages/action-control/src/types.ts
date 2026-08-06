export type ActionDomain = "financial" | "code" | "database" | "mcp" | "unknown";
export type ActionEffect = "read" | "write" | "destructive" | "unknown";
export type Decision =
  "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "LIMIT" | "REDACT" | "SANDBOX" | "PAUSE" | "FREEZE";
export type EvaluationMode = "shadow" | "enforce";

export interface RawActionReference {
  provider: string;
  operation: string;
  requestId?: string;
  toolName?: string;
}

export interface SemanticAction {
  name: string;
  version: "0.1";
  domain: ActionDomain;
  effect: ActionEffect;
  parameters: Record<string, unknown>;
  resource?: string;
  environment?: string;
  amountMinor?: number;
  currency?: string;
  raw: RawActionReference;
  known: boolean;
}

export interface AuthorityScope {
  actions: string[];
  resources?: string[];
  environments?: string[];
  maxAmountMinor?: number;
  currency?: string;
  maxCount?: number;
  validFrom?: string;
  expiresAt?: string;
  maxDelegationDepth?: number;
  purpose?: string;
}

export interface CumulativeState {
  actionCount: number;
  amountMinor: number;
  recentActions?: string[];
}

export interface ControlPolicy {
  version: string;
  denyActions?: string[];
  approvalActions?: string[];
  approvalAboveMinor?: number;
  dailyAmountLimitMinor?: number;
  dangerousSequences?: string[][];
  unknownWriteDecision?: "DENY" | "APPROVAL_REQUIRED";
}

export interface EvaluationInput {
  mode: EvaluationMode;
  action: SemanticAction;
  authority: AuthorityScope | null;
  cumulative?: CumulativeState;
  policy?: ControlPolicy;
  now?: Date;
  frozen?: boolean;
}

export interface EvaluationResult {
  decision: Decision;
  effectiveDecision: "ALLOW" | "DENY" | "PENDING_APPROVAL";
  wouldBlock: boolean;
  enforced: boolean;
  reasons: string[];
  policyVersion: string;
}

export interface AttenuationResult {
  valid: boolean;
  reasons: string[];
}
