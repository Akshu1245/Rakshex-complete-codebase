/**
 * Control catalog mapped to major frameworks.
 * This is a control library — NOT a certification.
 */

export type FrameworkId =
  | "owasp_api_top10"
  | "owasp_llm_top10"
  | "nist_ai_rmf"
  | "iso_27001"
  | "iso_42001"
  | "soc2"
  | "gdpr"
  | "india_dpdp"
  | "eu_ai_act";

export type ControlStatus =
  "not_started" | "in_progress" | "implemented" | "not_applicable" | "exception";

export interface ControlDefinition {
  id: string;
  title: string;
  description: string;
  frameworks: FrameworkId[];
  /** Suggested evidence types */
  evidenceTypes: string[];
  ownerRole?: string;
}

export const CONTROL_CATALOG: ControlDefinition[] = [
  {
    id: "CTRL-AUTH-01",
    title: "Strong authentication",
    description: "Users authenticate with hashed passwords or SSO; MFA available",
    frameworks: ["owasp_api_top10", "soc2", "iso_27001", "gdpr"],
    evidenceTypes: ["auth_config", "mfa_enrollment"],
    ownerRole: "security",
  },
  {
    id: "CTRL-AUTHZ-01",
    title: "Tenant isolation / BOLA prevention",
    description: "Authorization checks on every object access",
    frameworks: ["owasp_api_top10", "soc2", "iso_27001"],
    evidenceTypes: ["authz_tests", "audit_logs"],
    ownerRole: "engineering",
  },
  {
    id: "CTRL-LLM-01",
    title: "Prompt injection defenses",
    description: "Gateway detects and blocks common prompt-injection patterns",
    frameworks: ["owasp_llm_top10", "nist_ai_rmf", "iso_42001", "eu_ai_act"],
    evidenceTypes: ["gateway_policy", "scan_results"],
    ownerRole: "security",
  },
  {
    id: "CTRL-LLM-02",
    title: "Agent kill switch and budget limits",
    description: "Operators can disable agents and cap spend",
    frameworks: ["owasp_llm_top10", "nist_ai_rmf", "iso_42001"],
    evidenceTypes: ["kill_switch_audit", "budget_config"],
    ownerRole: "ops",
  },
  {
    id: "CTRL-LLM-03",
    title: "MCP tool allowlisting",
    description: "Dangerous MCP tools require allowlist and risk scoring",
    frameworks: ["owasp_llm_top10", "nist_ai_rmf", "eu_ai_act"],
    evidenceTypes: ["mcp_inventory", "tool_allowlist"],
    ownerRole: "security",
  },
  {
    id: "CTRL-DATA-01",
    title: "Data minimization and privacy modes",
    description: "SDK defaults to metadata-only; zero-retention available",
    frameworks: ["gdpr", "india_dpdp", "soc2", "iso_27001"],
    evidenceTypes: ["sdk_privacy_config", "retention_policy"],
    ownerRole: "privacy",
  },
  {
    id: "CTRL-DATA-02",
    title: "Subject access and deletion",
    description: "Export and delete personal data on request",
    frameworks: ["gdpr", "india_dpdp", "soc2"],
    evidenceTypes: ["data_export_logs", "deletion_logs"],
    ownerRole: "privacy",
  },
  {
    id: "CTRL-LOG-01",
    title: "Security event logging",
    description: "Auth, kill-switch, and policy events are audited",
    frameworks: ["soc2", "iso_27001", "owasp_api_top10"],
    evidenceTypes: ["audit_export", "security_events"],
    ownerRole: "security",
  },
  {
    id: "CTRL-CRYPTO-01",
    title: "Secrets not in logs",
    description: "Secret redaction in structured logs",
    frameworks: ["owasp_api_top10", "soc2", "iso_27001"],
    evidenceTypes: ["log_samples", "redaction_tests"],
    ownerRole: "engineering",
  },
  {
    id: "CTRL-AI-GOV-01",
    title: "AI inventory and risk scoring",
    description: "Maintain inventory of AI assets and MCP servers",
    frameworks: ["nist_ai_rmf", "iso_42001", "eu_ai_act"],
    evidenceTypes: ["ai_inventory", "risk_scores"],
    ownerRole: "governance",
  },
];

export const NON_CERTIFICATION_DISCLAIMER =
  "Rakshex compliance reports map system evidence to control frameworks for operational readiness. " +
  "They do NOT constitute SOC 2, ISO 27001, ISO 42001, GDPR, DPDP, or EU AI Act certification, " +
  "attestation, or legal advice. Engage a qualified auditor for formal certification.";
