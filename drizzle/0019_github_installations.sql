-- Migration: GitHub App installations table
-- Stores installation-to-workspace mappings for the GitHub App integration.
-- Rollback: DROP TABLE github_installations;

CREATE TABLE IF NOT EXISTS github_installations (
  installation_id BIGINT PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  account_login VARCHAR(255) NOT NULL,
  account_type ENUM('Organization', 'User') NOT NULL,
  installed_at TIMESTAMP DEFAULT NOW(),
  suspended_at TIMESTAMP NULL,
  permissions JSON NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Add github_installations to Drizzle schema inline:
-- ALTER TABLE will be a no-op if the column already exists.
-- The schema.ts table definition handles the TypeScript types.
