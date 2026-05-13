/**
 * Built-in YAML policy templates.
 *
 * These ship in-product so a tenant can pick a baseline (Strict / Balanced /
 * Permissive / India-PII / Demo-Loose) and customize from there. Each template
 * is a fully-valid policy file — `parsePolicy(template)` succeeds without
 * edits, and `compilePolicy()` produces sane runtime behavior.
 */

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  yaml: string;
}

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "strict",
    name: "Strict (Production / Regulated)",
    description:
      "Block-by-default posture for regulated environments. Aggressive PII redaction, low injection threshold, hard token caps, kill-switch armed.",
    yaml: `name: "Strict Production"
version: 1
applies_to: ["all"]
description: "Block-by-default policy for SOC2/PCI/HIPAA-aligned tenants."
rules:
  - id: pii_redaction
    enabled: true
    redact: [EMAIL, PHONE, SSN, CREDIT_CARD, AADHAAR, PAN, IFSC, PASSPORT_IN]
    action: mask
  - id: prompt_injection
    enabled: true
    threshold: 50
    on_detection: block
  - id: token_budget
    enabled: true
    daily_tokens: 250000
    monthly_usd: 100
    on_breach: block
  - id: kill_switch
    enabled: true
    cost_anomaly_multiplier: 3
    error_rate_threshold: 0.25
  - id: tool_approval
    enabled: true
    allowlist: []
    require_approval: []
    deny_by_default: true
`,
  },
  {
    id: "balanced",
    name: "Balanced (Default)",
    description:
      "Reasonable defaults for most production workloads — PII masking, mid-threshold injection block, soft caps with warnings.",
    yaml: `name: "Balanced Default"
version: 1
applies_to: ["all"]
description: "Recommended starting policy. Block egregious behavior, warn on the rest."
rules:
  - id: pii_redaction
    enabled: true
    redact: [EMAIL, PHONE, SSN, CREDIT_CARD]
    action: mask
  - id: prompt_injection
    enabled: true
    threshold: 70
    on_detection: block
  - id: token_budget
    enabled: true
    daily_tokens: 1000000
    monthly_usd: 500
    on_breach: warn
  - id: kill_switch
    enabled: true
    cost_anomaly_multiplier: 5
    error_rate_threshold: 0.5
  - id: tool_approval
    enabled: false
    allowlist: []
    require_approval: []
    deny_by_default: false
`,
  },
  {
    id: "permissive",
    name: "Permissive (Internal / Dev)",
    description:
      "Loose policy for internal tools and development tenants. Warn-only, no kill-switch trip, generous budgets.",
    yaml: `name: "Permissive Dev"
version: 1
applies_to: ["dev", "qa"]
description: "Used for non-customer-facing tenants. Logs everything, blocks little."
rules:
  - id: pii_redaction
    enabled: false
    redact: []
    action: mask
  - id: prompt_injection
    enabled: true
    threshold: 90
    on_detection: warn
  - id: token_budget
    enabled: true
    daily_tokens: 5000000
    monthly_usd: 2500
    on_breach: warn
  - id: kill_switch
    enabled: false
  - id: tool_approval
    enabled: false
    allowlist: []
    require_approval: []
    deny_by_default: false
`,
  },
  {
    id: "india-pii",
    name: "India PII (Aadhaar / PAN / IFSC)",
    description:
      "Targets Indian PII patterns specifically — required for fintech / KYC workloads operating under DPDP Act.",
    yaml: `name: "India PII Strict"
version: 1
applies_to: ["all"]
description: "Aadhaar / PAN / IFSC / Indian-passport masking for DPDP-covered workloads."
rules:
  - id: pii_redaction
    enabled: true
    redact: [AADHAAR, PAN, IFSC, PASSPORT_IN, PHONE, EMAIL]
    action: mask
  - id: prompt_injection
    enabled: true
    threshold: 60
    on_detection: block
  - id: token_budget
    enabled: true
    daily_tokens: 500000
    monthly_usd: 200
    on_breach: block
  - id: kill_switch
    enabled: true
    cost_anomaly_multiplier: 4
    error_rate_threshold: 0.3
  - id: tool_approval
    enabled: true
    allowlist: []
    require_approval: []
    deny_by_default: true
`,
  },
  {
    id: "demo-loose",
    name: "Demo / Trial",
    description:
      "For sandbox accounts. Minimal blocks, very small daily token budget so accounts can't accidentally rack up provider bills.",
    yaml: `name: "Demo Trial"
version: 1
applies_to: ["trial"]
description: "Tight token budget, loose policy — designed for sandbox demos."
rules:
  - id: pii_redaction
    enabled: true
    redact: [EMAIL]
    action: mask
  - id: prompt_injection
    enabled: true
    threshold: 80
    on_detection: warn
  - id: token_budget
    enabled: true
    daily_tokens: 50000
    monthly_usd: 5
    on_breach: block
  - id: kill_switch
    enabled: true
    cost_anomaly_multiplier: 2
    error_rate_threshold: 0.5
  - id: tool_approval
    enabled: false
    allowlist: []
    require_approval: []
    deny_by_default: false
`,
  },
];

export function getPolicyTemplate(id: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find(t => t.id === id);
}
