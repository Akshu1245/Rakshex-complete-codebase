-- Migration: AI Events telemetry table
-- Replaces the in-memory telemetryBuffer in server/api/telemetry.ts

CREATE TABLE `ai_events` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `eventId` varchar(36) NOT NULL UNIQUE,
  `userId` int NOT NULL,
  `workspaceId` varchar(64) NOT NULL,
  `agentId` varchar(64) NOT NULL,
  `userHash` varchar(128),
  `provider` varchar(32) NOT NULL,
  `model` varchar(128) NOT NULL,
  `requestTimestamp` timestamp NOT NULL,
  `latencyMs` int NOT NULL,
  `inputTokens` int NOT NULL DEFAULT 0,
  `outputTokens` int NOT NULL DEFAULT 0,
  `cachedTokens` int NOT NULL DEFAULT 0,
  `costUsd` decimal(10, 6) NOT NULL DEFAULT 0.000000,
  `status` ENUM('ok', 'error', 'timeout', 'blocked') NOT NULL DEFAULT 'ok',
  `redactionCount` int NOT NULL DEFAULT 0,
  `promptHash` varchar(64) NOT NULL,
  `responseHash` varchar(64) NOT NULL,
  `toolCalls` json,
  `metadata` json,
  `createdAt` timestamp DEFAULT NOW() NOT NULL,
  INDEX `userId_idx` (`userId`),
  INDEX `workspaceId_idx` (`workspaceId`),
  INDEX `agentId_idx` (`agentId`),
  INDEX `createdAt_idx` (`createdAt`),
  INDEX `provider_idx` (`provider`),
  INDEX `model_idx` (`model`),
  INDEX `status_idx` (`status`),
  INDEX `requestTs_idx` (`requestTimestamp`)
);
