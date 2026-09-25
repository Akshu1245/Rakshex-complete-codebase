/**
 * Bridge: server uses @rakshex/policy-engine for rebuild-plan policy-as-code.
 * The old tenant YAML DSL (policyDsl.ts) was deleted — cut #5, duplicate
 * policy language. Tenant YAML now parses through @rakshex/policy-engine.
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
