/**
 * Bridge: server uses @rakshex/policy-engine for rebuild-plan policy-as-code.
 * Existing YAML gateway DSL remains in policyDsl.ts (tenant gateway compile).
 */

export {
  parsePolicy,
  PolicyParseError,
  compilePolicy,
  evaluatePolicy,
  simulatePolicy,
  type PolicyDocument,
  type PolicyDecision,
  type EvaluationContext,
  type CompiledPolicy,
} from "@rakshex/policy-engine";
