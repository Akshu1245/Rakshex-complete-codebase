import type { ScanRule } from "../types.js";
import {
  debugHeadersRule,
  idorIndicatorRule,
  insecureHttpRule,
  missingAuthRule,
  missingCorrelationRule,
  sensitiveQueryRule,
  ssrfIndicatorRule,
  excessiveAgencyRule,
  insecurePluginOutputRule,
  promptInjectionSurfaceRule,
} from "./rules.js";

/** Default deterministic API security rule pack. */
export const DEFAULT_API_RULES: ScanRule[] = [
  insecureHttpRule,
  missingAuthRule,
  idorIndicatorRule,
  sensitiveQueryRule,
  debugHeadersRule,
  missingCorrelationRule,
  ssrfIndicatorRule,
];

/** Deterministic AI / agent security rules (no external LLM calls). */
export const DEFAULT_AI_RULES: ScanRule[] = [
  promptInjectionSurfaceRule,
  excessiveAgencyRule,
  insecurePluginOutputRule,
];

/** Full default pack used by production scans. */
export const DEFAULT_RULES: ScanRule[] = [...DEFAULT_API_RULES, ...DEFAULT_AI_RULES];

export function getRuleById(id: string): ScanRule | undefined {
  return DEFAULT_RULES.find((r) => r.id === id);
}

export function listRuleIds(): string[] {
  return DEFAULT_RULES.map((r) => r.id);
}

export function listRules(): ScanRule[] {
  return [...DEFAULT_RULES];
}
