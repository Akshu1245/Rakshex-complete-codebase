export type {
  ConfidenceLabel,
  FindingCategory,
  LegacyFinding,
  NormalizedCollection,
  NormalizedEndpoint,
  RuleEvidence,
  RuleFinding,
  RuleStandards,
  ScanResult,
  ScanRule,
  Severity,
} from "./types.js";

export { normalizeCollection, safeGetPath, hasAuthHeader, fingerprint } from "./normalize.js";
export {
  runScan,
  toLegacyFindings,
  calculateRiskScore,
  getRiskLevel,
  type RunScanOptions,
} from "./engine.js";
export {
  DEFAULT_API_RULES,
  DEFAULT_AI_RULES,
  DEFAULT_RULES,
  getRuleById,
  listRuleIds,
  listRules,
} from "./rules/registry.js";
export {
  scanTextForSecrets,
  scanPathForSecrets,
  listSecretRuleIds,
  type SecretFinding,
  type SecretSeverity,
  type SecretClassification,
  type VerificationStatus,
} from "./secrets.js";
export {
  evaluateGate,
  loadAllowlist,
  loadPolicy,
  validateAllowlist,
  DEFAULT_POLICY,
  type GateResult,
  type AllowlistEntry,
  type SecretsPolicy,
} from "./secrets-policy.js";

// YC #13 (beta): static, conservative OpenAPI contract differences.
export {
  diffOpenApiContracts,
  type ContractChange,
  type ContractChangeKind,
  type ContractDiffResult,
} from "./contractDiff.js";
