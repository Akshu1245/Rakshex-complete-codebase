import { parse as parseYaml, YAMLParseError } from "yaml";
import type { ConditionOp, DecisionAction, GenericRule, PolicyDocument } from "./types.js";

export class PolicyParseError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "PolicyParseError";
  }
}

function asStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new PolicyParseError(`Expected array at ${path}`);
  }
  return value.map((v, i) => {
    if (typeof v !== "string") {
      throw new PolicyParseError(`Expected string at ${path}[${i}]`);
    }
    return v;
  });
}

function asPositiveNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new PolicyParseError(`Expected non-negative number at ${path}`);
  }
  return value;
}

/**
 * Parse and validate a policy document from YAML or JSON text / object.
 */
export function parsePolicy(input: string | unknown): PolicyDocument {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = parseYaml(input);
    } catch (err) {
      if (err instanceof YAMLParseError) {
        throw new PolicyParseError("Invalid YAML policy", [err.message]);
      }
      throw err;
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PolicyParseError("Policy root must be an object");
  }

  const obj = raw as Record<string, unknown>;
  const version = obj.version;
  if (version !== 1 && version !== "1") {
    throw new PolicyParseError("Unsupported policy version (expected 1)", [
      `got ${String(version)}`,
    ]);
  }

  const doc: PolicyDocument = { version: 1 };

  if (typeof obj.name === "string") doc.name = obj.name;
  if (typeof obj.description === "string") doc.description = obj.description;

  if (obj.agent && typeof obj.agent === "object") {
    const a = obj.agent as Record<string, unknown>;
    doc.agent = {
      max_steps: asPositiveNumber(a.max_steps, "agent.max_steps"),
      max_retries: asPositiveNumber(a.max_retries, "agent.max_retries"),
      max_cost_usd: asPositiveNumber(a.max_cost_usd, "agent.max_cost_usd"),
      timeout_seconds: asPositiveNumber(a.timeout_seconds, "agent.timeout_seconds"),
    };
  }

  if (obj.models && typeof obj.models === "object") {
    const m = obj.models as Record<string, unknown>;
    doc.models = {
      allow: asStringArray(m.allow, "models.allow"),
      deny: asStringArray(m.deny, "models.deny"),
    };
  }

  if (obj.tools && typeof obj.tools === "object") {
    const t = obj.tools as Record<string, unknown>;
    doc.tools = {
      allow: asStringArray(t.allow, "tools.allow"),
      deny: asStringArray(t.deny, "tools.deny"),
      require_approval: asStringArray(t.require_approval, "tools.require_approval"),
      deny_by_default: typeof t.deny_by_default === "boolean" ? t.deny_by_default : undefined,
    };
  }

  if (obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    const action = d.action;
    if (
      action !== undefined &&
      action !== "mask" &&
      action !== "hash" &&
      action !== "drop" &&
      action !== "block"
    ) {
      throw new PolicyParseError("Invalid data.action");
    }
    doc.data = {
      block: asStringArray(d.block, "data.block"),
      redact: asStringArray(d.redact, "data.redact"),
      action: action as PolicyDocument["data"] extends infer D
        ? D extends { action?: infer A }
          ? A
          : never
        : never,
    };
  }

  if (obj.network && typeof obj.network === "object") {
    const n = obj.network as Record<string, unknown>;
    doc.network = {
      allow_domains: asStringArray(n.allow_domains, "network.allow_domains"),
      deny_domains: asStringArray(n.deny_domains, "network.deny_domains"),
    };
  }

  if (obj.rules !== undefined) {
    doc.rules = asGenericRules(obj.rules, "rules");
  }

  return doc;
}

const VALID_OPS = new Set([
  "eq",
  "in",
  "not_in",
  "gt",
  "lt",
  "gte",
  "lte",
  "regex",
  "keyword",
  "between",
]);
const VALID_ACTIONS = new Set(["allow", "deny", "require_approval", "redact", "warn"]);

function asGenericRules(value: unknown, path: string): GenericRule[] {
  if (!Array.isArray(value)) {
    throw new PolicyParseError(`Expected array at ${path}`);
  }
  return value.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new PolicyParseError(`Expected object at ${path}[${i}]`);
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.ruleId !== "string" || !r.ruleId) {
      throw new PolicyParseError(`Expected non-empty string at ${path}[${i}].ruleId`);
    }
    if (typeof r.priority !== "number") {
      throw new PolicyParseError(`Expected number at ${path}[${i}].priority`);
    }
    if (typeof r.action !== "string" || !VALID_ACTIONS.has(r.action)) {
      throw new PolicyParseError(
        `Expected one of allow|deny|require_approval|redact|warn at ${path}[${i}].action`,
      );
    }
    const cond = r.conditions as Record<string, unknown> | undefined;
    if (!cond || (cond.operator !== "AND" && cond.operator !== "OR") || !Array.isArray(cond.rules)) {
      throw new PolicyParseError(
        `Expected { operator: "AND"|"OR", rules: [...] } at ${path}[${i}].conditions`,
      );
    }
    const conditions = cond.rules.map((c, j) => {
      if (!c || typeof c !== "object") {
        throw new PolicyParseError(`Expected object at ${path}[${i}].conditions.rules[${j}]`);
      }
      const cc = c as Record<string, unknown>;
      if (typeof cc.field !== "string" || !cc.field) {
        throw new PolicyParseError(`Expected non-empty string at ${path}[${i}].conditions.rules[${j}].field`);
      }
      if (typeof cc.op !== "string" || !VALID_OPS.has(cc.op)) {
        throw new PolicyParseError(`Invalid op at ${path}[${i}].conditions.rules[${j}].op`);
      }
      if (cc.value === undefined) {
        throw new PolicyParseError(`Missing value at ${path}[${i}].conditions.rules[${j}].value`);
      }
      return {
        field: cc.field,
        op: cc.op as ConditionOp,
        value: cc.value as string | string[] | number | [number, number],
      };
    });
    return {
      ruleId: r.ruleId,
      name: typeof r.name === "string" ? r.name : undefined,
      priority: r.priority,
      enabled: typeof r.enabled === "boolean" ? r.enabled : true,
      conditions: { operator: cond.operator as "AND" | "OR", rules: conditions },
      action: r.action as DecisionAction,
    };
  });
}
