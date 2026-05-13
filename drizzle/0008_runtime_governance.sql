-- Sprint 3: AI runtime governance schema additions.
-- Tables: gateway_audit, token_budgets, shadow_ai_events, ai_allowlist,
--         redteam_runs, redteam_findings, redteam_schedules,
--         autofix_suggestions, copilot_conversations, copilot_messages.

CREATE TABLE IF NOT EXISTS `gateway_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `requestId` varchar(64) NOT NULL,
  `model` varchar(96) NOT NULL,
  `provider` varchar(32),
  `decision` enum('allowed','blocked','errored') NOT NULL DEFAULT 'allowed',
  `blockReason` varchar(96),
  `promptTokens` int NOT NULL DEFAULT 0,
  `completionTokens` int NOT NULL DEFAULT 0,
  `totalTokens` int NOT NULL DEFAULT 0,
  `estimatedCostUsd` decimal(10,6) NOT NULL DEFAULT 0,
  `promptFingerprint` varchar(64),
  `latencyMs` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `createdAt_idx` (`createdAt`),
  KEY `decision_idx` (`decision`),
  KEY `model_idx` (`model`)
);

CREATE TABLE IF NOT EXISTS `token_budgets` (
  `userId` int NOT NULL,
  `dailyTokenLimit` int,
  `mode` enum('soft','hard') NOT NULL DEFAULT 'soft',
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`)
);

CREATE TABLE IF NOT EXISTS `shadow_ai_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `source` varchar(64) NOT NULL,
  `detectedHost` varchar(192) NOT NULL,
  `detectedModel` varchar(96),
  `isAllowlisted` boolean NOT NULL DEFAULT false,
  `severity` enum('info','low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `rawSignals` json,
  `occurredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `severity_idx` (`severity`),
  KEY `detectedHost_idx` (`detectedHost`)
);

CREATE TABLE IF NOT EXISTS `ai_allowlist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `kind` enum('host','model') NOT NULL,
  `pattern` varchar(192) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `redteam_runs` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `target` varchar(192) NOT NULL,
  `triggeredBy` enum('manual','schedule','api') NOT NULL DEFAULT 'manual',
  `status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
  `totalPayloads` int NOT NULL DEFAULT 0,
  `blockedCount` int NOT NULL DEFAULT 0,
  `leakedCount` int NOT NULL DEFAULT 0,
  `erroredCount` int NOT NULL DEFAULT 0,
  `securityScore` int,
  `durationMs` int,
  `startedAt` timestamp NULL,
  `finishedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `status_idx` (`status`),
  KEY `createdAt_idx` (`createdAt`)
);

CREATE TABLE IF NOT EXISTS `redteam_findings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `runId` varchar(64) NOT NULL,
  `payloadId` varchar(64) NOT NULL,
  `category` varchar(64) NOT NULL,
  `severity` enum('Low','Medium','High','Critical') NOT NULL,
  `outcome` enum('blocked','leaked','errored') NOT NULL,
  `sample` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `runId_idx` (`runId`),
  KEY `outcome_idx` (`outcome`)
);

CREATE TABLE IF NOT EXISTS `redteam_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `target` varchar(192) NOT NULL,
  `cron` varchar(64) NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `lastRunAt` timestamp NULL,
  `nextRunAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `active_idx` (`isActive`)
);

CREATE TABLE IF NOT EXISTS `autofix_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `findingType` varchar(64) NOT NULL,
  `findingRef` varchar(128),
  `title` varchar(192) NOT NULL,
  `rationale` text,
  `languageHint` varchar(32),
  `snippet` text NOT NULL,
  `status` enum('open','applied','dismissed') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `status_idx` (`status`),
  KEY `findingType_idx` (`findingType`)
);

CREATE TABLE IF NOT EXISTS `copilot_conversations` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `title` varchar(192) NOT NULL DEFAULT 'New chat',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `copilot_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversationId` varchar(64) NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `references` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `conversation_idx` (`conversationId`)
);
