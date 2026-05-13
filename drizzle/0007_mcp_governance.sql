-- Sprint 2 — MCP Governance scaffolding.
--
-- Adds three tables that let us register MCP servers, enumerate their tools,
-- and persist an audit trail of every tool invocation routed through the
-- inline gateway. None of these is wired into the live request path yet —
-- the gateway logs to `audit_log` for now and only ships the permission-graph
-- query surface. The MCP enforcement loop is sequenced for Sprint 3.

CREATE TABLE `mcp_servers` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`url` varchar(1024),
	`transport` enum('stdio','streamable-http','sse') NOT NULL,
	`capabilityFingerprint` json,
	`riskScore` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`discoveredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`lastSeenAt` timestamp,
	CONSTRAINT `mcp_servers_id` PRIMARY KEY(`id`)
);

CREATE INDEX `mcp_servers_userId_idx` ON `mcp_servers` (`userId`);

CREATE TABLE `mcp_tools` (
	`id` varchar(64) NOT NULL,
	`serverId` varchar(64) NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`riskClass` enum('safe','elevated','unsafe','unknown') NOT NULL DEFAULT 'unknown',
	`inputSchema` json,
	`isApproved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_tools_id` PRIMARY KEY(`id`)
);

CREATE INDEX `mcp_tools_serverId_idx` ON `mcp_tools` (`serverId`);

CREATE TABLE `mcp_invocation_log` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`serverId` varchar(64) NOT NULL,
	`toolId` varchar(64) NOT NULL,
	`requestId` varchar(64),
	`argsFingerprint` varchar(64),
	`decision` enum('allowed','blocked','errored') NOT NULL,
	`blockReason` varchar(128),
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_invocation_log_id` PRIMARY KEY(`id`)
);

CREATE INDEX `mcp_invocation_log_userId_idx` ON `mcp_invocation_log` (`userId`);
CREATE INDEX `mcp_invocation_log_serverId_idx` ON `mcp_invocation_log` (`serverId`);
CREATE INDEX `mcp_invocation_log_toolId_idx` ON `mcp_invocation_log` (`toolId`);
CREATE INDEX `mcp_invocation_log_createdAt_idx` ON `mcp_invocation_log` (`createdAt`);
