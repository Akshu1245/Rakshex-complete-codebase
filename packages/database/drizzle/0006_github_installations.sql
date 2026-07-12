CREATE TABLE IF NOT EXISTS github_installations (
  id SERIAL PRIMARY KEY,
  "installationId" INTEGER NOT NULL UNIQUE,
  "workspaceId" INTEGER NOT NULL REFERENCES workspaces(id),
  "accountLogin" VARCHAR(255) NOT NULL,
  "accountType" VARCHAR(32) NOT NULL,
  permissions JSON NOT NULL DEFAULT '{}'::json,
  "linkedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_installations_workspace ON github_installations("workspaceId");
