/**
 * Built-in YAML policy templates.
 *
 * These ship in-product so a tenant can pick a baseline (Strict / Balanced /
 * Permissive / India-PII / Demo-Loose) and customize from there. Each template
 * is a fully-valid `@rakshex/policy-engine` v1 policy file — `parsePolicy`
 * succeeds without edits, and `compilePolicy()` produces sane runtime
 * behavior.
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
      "Block-by-default posture for regulated environments. Aggressive PII redaction, high injection scores denied, hard cost cap, tools denied unless allowed.",
    yaml: `name: "Strict Production"
version: 1
description: "Block-by-default policy for SOC2/PCI/HIPAA-aligned tenants."
agent:
  max_steps: 25
  max_retries: 2
  max_cost_usd: 100
  timeout_seconds: 300
tools:
  deny_by_default: true
data:
  redact: [email, phone, ssn, credit_card, aadhaar, pan, ifsc, passport_in]
  action: mask
rules:
  - ruleId: deny-high-injection
    name: "Deny high prompt-injection scores"
    priority: 10
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: in
          value: [high, critical]
    action: deny
`,
  },
  {
    id: "balanced",
    name: "Balanced (Default)",
    description:
      "Reasonable defaults for most production workloads — PII masking, high injection scores blocked, medium warned, generous cost cap.",
    yaml: `name: "Balanced Default"
version: 1
description: "Recommended starting policy. Block egregious behavior, warn on the rest."
agent:
  max_steps: 50
  max_retries: 3
  max_cost_usd: 500
  timeout_seconds: 600
tools:
  deny_by_default: false
data:
  redact: [email, phone, ssn, credit_card]
  action: mask
rules:
  - ruleId: deny-high-injection
    name: "Deny high prompt-injection scores"
    priority: 10
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: in
          value: [high, critical]
    action: deny
  - ruleId: warn-medium-injection
    name: "Warn on medium prompt-injection scores"
    priority: 20
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: eq
          value: medium
    action: warn
`,
  },
  {
    id: "permissive",
    name: "Permissive (Internal / Dev)",
    description:
      "Loose policy for internal tools and development tenants. Warn-only, generous budgets.",
    yaml: `name: "Permissive Dev"
version: 1
description: "Used for non-customer-facing tenants. Logs everything, blocks little."
agent:
  max_steps: 200
  max_retries: 5
  max_cost_usd: 2500
  timeout_seconds: 1800
tools:
  deny_by_default: false
data:
  redact: []
rules:
  - ruleId: warn-high-injection
    name: "Warn on high prompt-injection scores"
    priority: 10
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: in
          value: [high, critical]
    action: warn
`,
  },
  {
    id: "india-pii",
    name: "India PII (Aadhaar / PAN / IFSC)",
    description:
      "Targets Indian PII patterns specifically — required for fintech / KYC workloads operating under DPDP Act.",
    yaml: `name: "India PII Strict"
version: 1
description: "Aadhaar / PAN / IFSC / Indian-passport masking for DPDP-covered workloads."
agent:
  max_steps: 25
  max_retries: 2
  max_cost_usd: 200
  timeout_seconds: 300
tools:
  deny_by_default: true
data:
  redact: [aadhaar, pan, ifsc, passport_in, phone, email]
  action: mask
rules:
  - ruleId: deny-high-injection
    name: "Deny high prompt-injection scores"
    priority: 10
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: in
          value: [high, critical]
    action: deny
`,
  },
  {
    id: "demo-loose",
    name: "Demo / Trial",
    description:
      "For sandbox accounts. Minimal blocks, very small cost cap so accounts can't accidentally rack up provider bills.",
    yaml: `name: "Demo Trial"
version: 1
description: "Tight cost cap, loose policy — designed for sandbox demos."
agent:
  max_steps: 30
  max_retries: 2
  max_cost_usd: 5
  timeout_seconds: 300
tools:
  deny_by_default: false
data:
  redact: [email]
  action: mask
rules:
  - ruleId: warn-high-injection
    name: "Warn on high prompt-injection scores"
    priority: 10
    conditions:
      operator: AND
      rules:
        - field: threat_level
          op: in
          value: [high, critical]
    action: warn
`,
  },
];

export function getPolicyTemplate(id: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find((t) => t.id === id);
}
