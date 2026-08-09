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

export type DecisionAction = "allow" | "deny" | "require_approval" | "redact" | "warn";

export type ConditionOp =
  | "eq"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "regex"
  | "keyword"
  | "between";

/**
 * A single field/operator/value condition, evaluated against an
 * `EvaluationContext`. Field names accept both camelCase and snake_case
 * spellings (e.g. `threatLevel` / `threat_level`) — see `getFieldValue` in
 * `evaluate.ts` for the exact supported set.
 */
export interface RuleCondition {
  field: string;
  op: ConditionOp;
  value: string | string[] | number | [number, number];
}

/**
 * A generic, priority-ordered policy rule. This is the mechanism that
 * absorbed `apps/api/engines/policyEngine.ts`'s rule model into this
 * package — see CLAUDE.md §5 item 0 and `docs/POLICY_ENGINE_UNIFICATION.md`
 * for why two engines existed and why this field is how they became one.
 *
 * `rules` on a `PolicyDocument` are evaluated FIRST, sorted by ascending
 * `priority` (lower number = higher priority, first match wins), before the
 * structured `agent`/`models`/`tools`/`network`/`data` checks below run as
 * a fallback. This gives per-rule priority that can override category order
 * — the one thing the structured checks alone cannot express.
 */
export interface GenericRule {
  ruleId: string;
  name?: string;
  priority: number;
  /** Defaults to true when omitted. */
  enabled?: boolean;
  conditions: { operator: "AND" | "OR"; rules: RuleCondition[] };
  action: DecisionAction;
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
  /** See `GenericRule` above. Optional — most policies won't need it. */
  rules?: GenericRule[];
}

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
  /**
   * Full set of tool calls in this turn, when more than one is relevant.
   * `tool_name eq` conditions match if ANY entry's name matches. Falls back
   * to `toolName` above when omitted.
   */
  toolCalls?: Array<{ name: string }>;
  /** Destination host or URL for network checks. */
  destination?: string;
  /** Detected data labels in the payload (from DLP). */
  dataLabels?: string[];
  /** Agent step index (1-based). */
  step?: number;
  retryCount?: number;
  costUsdSoFar?: number;
  elapsedSeconds?: number;
  /** Prompt/response text, for `prompt_contains` keyword/regex conditions. */
  prompt?: string;
  /** MCP/prompt-scanner threat level, ordered none < low < medium < high < critical. */
  threatLevel?: "none" | "low" | "medium" | "high" | "critical";
  agentId?: string;
  userId?: string;
  inputTokens?: number;
  /** Used for `hour_of_day` conditions; defaults to evaluation time if omitted. */
  timestamp?: Date;
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
