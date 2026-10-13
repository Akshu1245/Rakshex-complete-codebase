ALTER TABLE cf_api_keys ADD COLUMN agent_id TEXT;
-- Old unbound runtime keys cannot silently acquire broader agent privileges.
UPDATE cf_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE role = 'runtime' AND agent_id IS NULL AND revoked_at IS NULL;
CREATE TRIGGER cf_runtime_key_agent_insert BEFORE INSERT ON cf_api_keys
 WHEN NEW.role = 'runtime' AND NOT EXISTS (SELECT 1 FROM cf_agents WHERE id = NEW.agent_id AND workspace_id = NEW.workspace_id AND status = 'active')
 BEGIN SELECT RAISE(ABORT,'runtime keys require an active same-workspace agent'); END;
CREATE TRIGGER cf_runtime_key_agent_update BEFORE UPDATE OF role,agent_id,workspace_id ON cf_api_keys
 WHEN NEW.role = 'runtime' AND NOT EXISTS (SELECT 1 FROM cf_agents WHERE id = NEW.agent_id AND workspace_id = NEW.workspace_id AND status = 'active')
 BEGIN SELECT RAISE(ABORT,'runtime keys require an active same-workspace agent'); END;
CREATE INDEX cf_keys_agent ON cf_api_keys(workspace_id,agent_id);
