-- Persist the stdio launch command for MCP servers. Previously validated at
-- registration time but never stored, so re-discovery and tool invocation
-- had no way to relaunch a stdio server (streamable-http/sse are unaffected —
-- they carry their endpoint in "url").
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "command" json;
