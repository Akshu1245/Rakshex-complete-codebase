/**
 * Policy-as-code document (Rakshex v1).
 * Matches the shape described in the rebuild plan §18.
 */

export interface AgentPolicy {
  max_steps?: number;
  max_retries?: number;
  max_cost_usd?: number;
  timeout_seconds?: number;
}

export interface ModelsPolicy {
  allow?: string[];
  deny?: string[];
}

export interface ToolsPolicy {
  allow?: string[];
  deny?: string[];
  require_approval?: string[];
  deny_by_default?: boolean;
}

export interface DataPolicy {
  /** Labels to block (api_key, credit_card, aadhaar, pan, …). */
  block?: string[];
  /** Labels to redact rather than hard-block. */
  redact?: string[];
  action?: "mask" | "hash" | "drop" | "block";
}

export interface NetworkPolicy {
  allow_domains?: string[];
  deny_domains?: string[];
}

export interface PolicyDocument {
  version: number;
  name?: string;
  description?: string;
  agent?: AgentPolicy;
  models?: ModelsPolicy;
  tools?: ToolsPolicy;
  data?: DataPolicy;
  network?: NetworkPolicy;
}

export type DecisionAction = "allow" | "deny" | "require_approval" | "redact" | "warn";

export interface PolicyDecision {
  action: DecisionAction;
  reasons: string[];
  matchedRules: string[];
  /** When action is redact, which labels triggered. */
  redactionLabels?: string[];
}

export interface EvaluationContext {
  model?: string;
  provider?: string;
  toolName?: string;
  /** Destination host or URL for network checks. */
  destination?: string;
  /** Detected data labels in the payload (from DLP). */
  dataLabels?: string[];
  /** Agent step index (1-based). */
  step?: number;
  retryCount?: number;
  costUsdSoFar?: number;
  elapsedSeconds?: number;
  /** Dry-run: compute decision without implying enforcement side effects. */
  dryRun?: boolean;
}

export interface CompiledPolicy {
  document: PolicyDocument;
  /** Fast lookups */
  allowedModels: Set<string> | null;
  deniedModels: Set<string>;
  deniedTools: Set<string>;
  approvalTools: Set<string>;
  allowedTools: Set<string> | null;
  denyToolsByDefault: boolean;
  blockLabels: Set<string>;
  redactLabels: Set<string>;
  dataAction: DataPolicy["action"];
  allowDomains: string[] | null;
  denyDomains: string[];
}
