/**
 * YAML Policy DSL — declarative tenant policies that compile into runtime
 * gateway decisions.
 *
 * A YAML policy describes the redaction / budget / injection / kill-switch /
 * tool-approval behavior for a tenant in a single human-editable file.
 * The parser produces a strongly-typed `Policy` object, validates every field
 * (returning structured `PolicyValidationError`s on bad input), and exposes
 * `compilePolicy()` which collapses the rule set into the boolean / numeric
 * settings the gateway already understands.
 *
 * The DSL is intentionally narrow: it covers the policy surfaces the gateway
 * already enforces (PII redaction, prompt-injection block threshold, token
 * budgets, kill-switch thresholds, tool allow/approve lists). New rules MUST
 * be added to both `RULE_KINDS` and `compilePolicy()` so the runtime stays
 * in sync with the schema.
 */

import { parse as parseYaml, YAMLParseError } from "yaml";

export const RULE_KINDS = [
  "pii_redaction",
  "prompt_injection",
  "token_budget",
  "kill_switch",
  "tool_approval",
] as const;

export type RuleKind = (typeof RULE_KINDS)[number];

export type PiiRedactionAction = "mask" | "hash" | "drop";

export interface PiiRedactionRule {
  kind: "pii_redaction";
  enabled: boolean;
  /**
   * Pattern names to redact. The gateway PII policy understands a fixed set
   * (EMAIL, PHONE, SSN, CREDIT_CARD, AADHAAR, PAN, IFSC, PASSPORT_IN). The
   * parser does NOT validate against this set — unknown labels are passed
   * through so future detector additions don't break old policy files.
   */
  redact: string[];
  action: PiiRedactionAction;
}

export interface PromptInjectionRule {
  kind: "prompt_injection";
  enabled: boolean;
  /** Block when the per-request injection score is >= this value (0..100). */
  threshold: number;
  onDetection: "block" | "warn";
}

export interface TokenBudgetRule {
  kind: "token_budget";
  enabled: boolean;
  dailyTokens?: number;
  monthlyUsd?: number;
  perModelDailyTokens?: Record<string, number>;
  onBreach: "block" | "warn";
}

export interface KillSwitchRule {
  kind: "kill_switch";
  enabled: boolean;
  /** Trip when realized cost exceeds `costAnomalyMultiplier × baseline`. */
  costAnomalyMultiplier?: number;
  /** Trip when error rate (0..1) over the recent window exceeds this. */
  errorRateThreshold?: number;
}

export interface ToolApprovalRule {
  kind: "tool_approval";
  enabled: boolean;
  allowlist: string[];
  requireApproval: string[];
  /** Tools not in either list are blocked when `denyByDefault` is true. */
  denyByDefault: boolean;
}

export type PolicyRule =
  | PiiRedactionRule
  | PromptInjectionRule
  | TokenBudgetRule
  | KillSwitchRule
  | ToolApprovalRule;

export interface Policy {
  name: string;
  version: number;
  /**
   * Free-form scope identifier. The gateway treats `"all"` as the wildcard
   * applies-to-everything default; specific values like `"prod"`, `"qa"`,
   * or `"sdk-key:abc"` are tenant-defined.
   */
  appliesTo: string[];
  description?: string;
  rules: PolicyRule[];
}

export interface PolicyValidationError {
  path: string;
  message: string;
}

export class PolicyValidationException extends Error {
  readonly errors: PolicyValidationError[];
  constructor(errors: PolicyValidationError[]) {
    super(
      errors.length === 0
        ? "policy validation failed"
        : `policy validation failed: ${errors[0].path}: ${errors[0].message}`,
    );
    this.errors = errors;
  }
}

/**
 * Parse a YAML string into a typed `Policy`. Throws `PolicyValidationException`
 * with the full list of structural errors. Never throws on field-level type
 * issues — those become accumulated `errors` so the caller can show them all.
 */
export function parsePolicy(yamlText: string): Policy {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    if (err instanceof YAMLParseError) {
      throw new PolicyValidationException([{ path: "$", message: `invalid YAML: ${err.message}` }]);
    }
    throw err;
  }
  if (!isObject(raw)) {
    throw new PolicyValidationException([{ path: "$", message: "policy root must be an object" }]);
  }

  const errors: PolicyValidationError[] = [];

  const name = pickString(raw.name, "name", errors) ?? "";
  const version = pickPositiveInt(raw.version, "version", errors) ?? 1;
  const appliesTo = pickStringArray(raw.applies_to ?? raw.appliesTo, "applies_to", errors) ?? [
    "all",
  ];
  const description = typeof raw.description === "string" ? raw.description : undefined;

  const rawRules = Array.isArray(raw.rules) ? raw.rules : null;
  if (rawRules == null) {
    errors.push({ path: "rules", message: "must be an array of rule objects" });
  }

  const rules: PolicyRule[] = [];
  if (rawRules) {
    for (let i = 0; i < rawRules.length; i++) {
      const compiled = parseRule(rawRules[i], `rules[${i}]`, errors);
      if (compiled) rules.push(compiled);
    }
  }

  if (errors.length > 0) {
    throw new PolicyValidationException(errors);
  }

  return { name, version, appliesTo, description, rules };
}

function parseRule(raw: unknown, path: string, errors: PolicyValidationError[]): PolicyRule | null {
  if (!isObject(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  const kind = raw.id ?? raw.kind ?? raw.type;
  if (typeof kind !== "string") {
    errors.push({ path: `${path}.id`, message: "rule must declare a string id" });
    return null;
  }
  if (!RULE_KINDS.includes(kind as RuleKind)) {
    errors.push({
      path: `${path}.id`,
      message: `unknown rule id "${kind}" (allowed: ${RULE_KINDS.join(", ")})`,
    });
    return null;
  }
  const enabled = raw.enabled === undefined ? true : raw.enabled === true;

  switch (kind as RuleKind) {
    case "pii_redaction":
      return parsePiiRule(raw, path, enabled, errors);
    case "prompt_injection":
      return parseInjectionRule(raw, path, enabled, errors);
    case "token_budget":
      return parseBudgetRule(raw, path, enabled, errors);
    case "kill_switch":
      return parseKillSwitchRule(raw, path, enabled, errors);
    case "tool_approval":
      return parseToolApprovalRule(raw, path, enabled, errors);
  }
}

function parsePiiRule(
  raw: Record<string, unknown>,
  path: string,
  enabled: boolean,
  errors: PolicyValidationError[],
): PiiRedactionRule {
  const redact = pickStringArray(raw.redact, `${path}.redact`, errors) ?? [];
  const actionRaw = raw.action ?? "mask";
  const action: PiiRedactionAction = ["mask", "hash", "drop"].includes(actionRaw as string)
    ? (actionRaw as PiiRedactionAction)
    : "mask";
  if (!["mask", "hash", "drop"].includes(actionRaw as string)) {
    errors.push({
      path: `${path}.action`,
      message: `must be one of: mask, hash, drop (got "${String(actionRaw)}")`,
    });
  }
  return { kind: "pii_redaction", enabled, redact, action };
}

function parseInjectionRule(
  raw: Record<string, unknown>,
  path: string,
  enabled: boolean,
  errors: PolicyValidationError[],
): PromptInjectionRule {
  const threshold = pickIntInRange(raw.threshold, `${path}.threshold`, 0, 100, errors) ?? 70;
  const onDetectionRaw = raw.on_detection ?? raw.onDetection ?? "block";
  const onDetection: "block" | "warn" = onDetectionRaw === "warn" ? "warn" : "block";
  if (onDetectionRaw !== "block" && onDetectionRaw !== "warn") {
    errors.push({
      path: `${path}.on_detection`,
      message: `must be "block" or "warn" (got "${String(onDetectionRaw)}")`,
    });
  }
  return { kind: "prompt_injection", enabled, threshold, onDetection };
}

function parseBudgetRule(
  raw: Record<string, unknown>,
  path: string,
  enabled: boolean,
  errors: PolicyValidationError[],
): TokenBudgetRule {
  const dailyTokens = pickPositiveInt(raw.daily_tokens, `${path}.daily_tokens`, errors);
  const monthlyUsdRaw = raw.monthly_usd;
  let monthlyUsd: number | undefined;
  if (monthlyUsdRaw !== undefined) {
    if (typeof monthlyUsdRaw === "number" && monthlyUsdRaw >= 0) {
      monthlyUsd = monthlyUsdRaw;
    } else {
      errors.push({
        path: `${path}.monthly_usd`,
        message: "must be a non-negative number",
      });
    }
  }
  const perModelRaw = raw.per_model_daily_tokens ?? raw.perModelDailyTokens;
  let perModelDailyTokens: Record<string, number> | undefined;
  if (perModelRaw !== undefined) {
    if (isObject(perModelRaw)) {
      const out: Record<string, number> = {};
      for (const [model, val] of Object.entries(perModelRaw)) {
        if (typeof val === "number" && val >= 0 && Number.isFinite(val)) {
          out[model] = Math.floor(val);
        } else {
          errors.push({
            path: `${path}.per_model_daily_tokens.${model}`,
            message: "must be a non-negative number",
          });
        }
      }
      perModelDailyTokens = out;
    } else {
      errors.push({
        path: `${path}.per_model_daily_tokens`,
        message: "must be an object mapping model -> number",
      });
    }
  }
  const onBreachRaw = raw.on_breach ?? raw.onBreach ?? "block";
  const onBreach: "block" | "warn" = onBreachRaw === "warn" ? "warn" : "block";
  if (onBreachRaw !== "block" && onBreachRaw !== "warn") {
    errors.push({
      path: `${path}.on_breach`,
      message: `must be "block" or "warn" (got "${String(onBreachRaw)}")`,
    });
  }
  return { kind: "token_budget", enabled, dailyTokens, monthlyUsd, perModelDailyTokens, onBreach };
}

function parseKillSwitchRule(
  raw: Record<string, unknown>,
  path: string,
  enabled: boolean,
  errors: PolicyValidationError[],
): KillSwitchRule {
  const costAnomalyMultiplier = pickPositiveFloat(
    raw.cost_anomaly_multiplier,
    `${path}.cost_anomaly_multiplier`,
    errors,
  );
  const errorRateRaw = raw.error_rate_threshold ?? raw.errorRateThreshold;
  let errorRateThreshold: number | undefined;
  if (errorRateRaw !== undefined) {
    if (typeof errorRateRaw === "number" && errorRateRaw >= 0 && errorRateRaw <= 1) {
      errorRateThreshold = errorRateRaw;
    } else {
      errors.push({
        path: `${path}.error_rate_threshold`,
        message: "must be between 0.0 and 1.0",
      });
    }
  }
  return { kind: "kill_switch", enabled, costAnomalyMultiplier, errorRateThreshold };
}

function parseToolApprovalRule(
  raw: Record<string, unknown>,
  path: string,
  enabled: boolean,
  errors: PolicyValidationError[],
): ToolApprovalRule {
  const allowlist = pickStringArray(raw.allowlist, `${path}.allowlist`, errors) ?? [];
  const requireApproval =
    pickStringArray(
      raw.require_approval ?? raw.requireApproval,
      `${path}.require_approval`,
      errors,
    ) ?? [];
  const denyByDefault = raw.deny_by_default === true || raw.denyByDefault === true;
  return { kind: "tool_approval", enabled, allowlist, requireApproval, denyByDefault };
}

/**
 * Compiled view of a policy that the gateway runtime can consume directly.
 * Mirrors the policy decisions the existing gateway middleware already makes,
 * just packaged as a single record so a tenant config-load is one read.
 */
export interface CompiledPolicy {
  name: string;
  version: number;
  appliesTo: string[];
  pii: { enabled: boolean; redact: string[]; action: PiiRedactionAction };
  promptInjection: { enabled: boolean; threshold: number; onDetection: "block" | "warn" };
  tokenBudget: {
    enabled: boolean;
    dailyTokens?: number;
    monthlyUsd?: number;
    perModelDailyTokens?: Record<string, number>;
    onBreach: "block" | "warn";
  };
  killSwitch: {
    enabled: boolean;
    costAnomalyMultiplier?: number;
    errorRateThreshold?: number;
  };
  toolApproval: {
    enabled: boolean;
    allowlist: string[];
    requireApproval: string[];
    denyByDefault: boolean;
  };
}

const DEFAULT_COMPILED: Omit<CompiledPolicy, "name" | "version" | "appliesTo"> = {
  pii: { enabled: false, redact: [], action: "mask" },
  promptInjection: { enabled: false, threshold: 70, onDetection: "block" },
  tokenBudget: { enabled: false, onBreach: "block" },
  killSwitch: { enabled: false },
  toolApproval: { enabled: false, allowlist: [], requireApproval: [], denyByDefault: false },
};

/**
 * Reduce a `Policy` to its runtime form. Disabled rules contribute disabled
 * settings; later rules of the same kind override earlier ones.
 */
export function compilePolicy(policy: Policy): CompiledPolicy {
  const compiled: CompiledPolicy = {
    name: policy.name,
    version: policy.version,
    appliesTo: policy.appliesTo,
    pii: { ...DEFAULT_COMPILED.pii },
    promptInjection: { ...DEFAULT_COMPILED.promptInjection },
    tokenBudget: { ...DEFAULT_COMPILED.tokenBudget },
    killSwitch: { ...DEFAULT_COMPILED.killSwitch },
    toolApproval: { ...DEFAULT_COMPILED.toolApproval },
  };
  for (const rule of policy.rules) {
    switch (rule.kind) {
      case "pii_redaction":
        compiled.pii = {
          enabled: rule.enabled,
          redact: rule.redact,
          action: rule.action,
        };
        break;
      case "prompt_injection":
        compiled.promptInjection = {
          enabled: rule.enabled,
          threshold: rule.threshold,
          onDetection: rule.onDetection,
        };
        break;
      case "token_budget":
        compiled.tokenBudget = {
          enabled: rule.enabled,
          dailyTokens: rule.dailyTokens,
          monthlyUsd: rule.monthlyUsd,
          perModelDailyTokens: rule.perModelDailyTokens,
          onBreach: rule.onBreach,
        };
        break;
      case "kill_switch":
        compiled.killSwitch = {
          enabled: rule.enabled,
          costAnomalyMultiplier: rule.costAnomalyMultiplier,
          errorRateThreshold: rule.errorRateThreshold,
        };
        break;
      case "tool_approval":
        compiled.toolApproval = {
          enabled: rule.enabled,
          allowlist: rule.allowlist,
          requireApproval: rule.requireApproval,
          denyByDefault: rule.denyByDefault,
        };
        break;
    }
  }
  return compiled;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown, path: string, errors: PolicyValidationError[]): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  errors.push({ path, message: "must be a non-empty string" });
  return null;
}

function pickStringArray(
  v: unknown,
  path: string,
  errors: PolicyValidationError[],
): string[] | null {
  if (!Array.isArray(v)) {
    if (v !== undefined) {
      errors.push({ path, message: "must be an array of strings" });
    }
    return null;
  }
  const out: string[] = [];
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") {
      errors.push({
        path: `${path}[${i}]`,
        message: "must be a string",
      });
      continue;
    }
    out.push(v[i] as string);
  }
  return out;
}

function pickPositiveInt(
  v: unknown,
  path: string,
  errors: PolicyValidationError[],
): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && Math.floor(v) === v) {
    return v;
  }
  errors.push({ path, message: "must be a positive integer" });
  return undefined;
}

function pickPositiveFloat(
  v: unknown,
  path: string,
  errors: PolicyValidationError[],
): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return v;
  }
  errors.push({ path, message: "must be a non-negative number" });
  return undefined;
}

function pickIntInRange(
  v: unknown,
  path: string,
  min: number,
  max: number,
  errors: PolicyValidationError[],
): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max && Math.floor(v) === v) {
    return v;
  }
  errors.push({ path, message: `must be an integer between ${min} and ${max}` });
  return undefined;
}
