-- Store adversarial-intent scan findings (typosquatting, hidden/zero-width
-- Unicode instructions, prompt-injection-shaped "rug pull" descriptions)
-- separately from the existing riskClass blast-radius classification.
-- @rakshex/mcp-security's scanToolForThreats() was a fully-built, tested
-- package that was never wired into the registration/discovery flow before
-- this migration — this column is what lets the findings persist and
-- surface in the dashboard once it is wired in.
ALTER TABLE "mcp_tools" ADD COLUMN IF NOT EXISTS "securityFindings" json;
