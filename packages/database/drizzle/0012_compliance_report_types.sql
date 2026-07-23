-- Extend the report_type enum to cover the compliance report kinds the
-- application generates. owasp_llm and dpdp were already produced by the API
-- but could not be persisted (enum only had pci_dss/owasp/custom); gdpr is new.
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'owasp_llm';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'dpdp';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'gdpr';
