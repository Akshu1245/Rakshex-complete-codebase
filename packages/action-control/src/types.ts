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
  /**
   * Spend already consumed this window, USD major units (decimal dollars).
   * A scope key that is absent is not governed; a key present with `null`
   * means spend state is UNKNOWN and the gate must DENY fail-closed —
   * never allow blind when a ceiling is configured.
   */
  spendSoFarUsd?: SpendUsdByScope;
}

export interface ControlPolicy {
  version: string;
  denyActions?: string[];
  approvalActions?: string[];
  approvalAboveMinor?: number;
  dailyAmountLimitMinor?: number;
  dangerousSequences?: string[][];
  unknownWriteDecision?: "DENY" | "APPROVAL_REQUIRED";
  /**
   * Real-time spend ceilings, USD major units (decimal dollars).
   * Enforced by evaluateAction as a hard DENY (see evaluate.ts).
   */
  spendCeilingsUsd?: SpendUsdByScope;
}

export interface EvaluationInput {
  mode: EvaluationMode;
  action: SemanticAction;
  authority: AuthorityScope | null;
  cumulative?: CumulativeState;
  policy?: ControlPolicy;
  now?: Date;
  frozen?: boolean;
  /**
   * Worst-case cost of the action being evaluated, USD major units.
   * The pre-request gate can only bound spend, never predict it: callers
   * must supply maxTokens-based worst-case cost (see @rakshex/spend-meter).
   */
  estimatedCostUsd?: number;
}

/**
 * Per-scope USD amounts (USD major units — decimal dollars, NOT minor/cents:
 * LLM cost math is fractional and rounding to cents at the gate would hide
 * sub-cent model calls).
 *
 * Scope names map to identity dimensions: the spend accrued by one agent, one
 * broker-issued key, or one user. A scope key that is absent is not governed;
 * a key present with `null` means the state is unknown.
 */
export type SpendScopeName = "agent" | "key" | "user";

export interface SpendUsdByScope {
  agent?: number | null;
  key?: number | null;
  user?: number | null;
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
