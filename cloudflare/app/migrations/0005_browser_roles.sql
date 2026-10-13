-- Issue #225 / PR #234: additive browser-only role attenuation.
-- Existing membership roles and session records are never rewritten.
-- browser_role can only further restrict the original membership role.
ALTER TABLE cf_workspace_memberships
  ADD COLUMN browser_role TEXT
  CHECK (browser_role IS NULL OR browser_role IN ('viewer','member','admin','owner'));
