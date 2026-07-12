import type { ScanRule } from "../types.js";
import { debugHeadersRule } from "./api/debug-headers.js";
import { idorIndicatorRule } from "./api/idor-indicator.js";
import { insecureHttpRule } from "./api/insecure-http.js";
import { missingAuthRule } from "./api/missing-auth.js";
import { missingCorrelationRule } from "./api/missing-correlation.js";
import { sensitiveQueryRule } from "./api/sensitive-query.js";
import { ssrfIndicatorRule } from "./api/ssrf-indicator.js";
import { excessiveAgencyRule } from "./ai/excessive-agency.js";
import { insecurePluginOutputRule } from "./ai/insecure-plugin-output.js";
import { promptInjectionSurfaceRule } from "./ai/prompt-injection-surface.js";

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
