import type { ScanRule } from "../types.js";
import { debugHeadersRule } from "./api/debug-headers.js";
import { idorIndicatorRule } from "./api/idor-indicator.js";
import { insecureHttpRule } from "./api/insecure-http.js";
import { missingAuthRule } from "./api/missing-auth.js";
import { missingCorrelationRule } from "./api/missing-correlation.js";
import { sensitiveQueryRule } from "./api/sensitive-query.js";
import { ssrfIndicatorRule } from "./api/ssrf-indicator.js";

/** Default deterministic API security rule pack (v0.1). */
export const DEFAULT_API_RULES: ScanRule[] = [
  insecureHttpRule,
  missingAuthRule,
  idorIndicatorRule,
  sensitiveQueryRule,
  debugHeadersRule,
  missingCorrelationRule,
  ssrfIndicatorRule,
];

export function getRuleById(id: string): ScanRule | undefined {
  return DEFAULT_API_RULES.find((r) => r.id === id);
}

export function listRuleIds(): string[] {
  return DEFAULT_API_RULES.map((r) => r.id);
}
