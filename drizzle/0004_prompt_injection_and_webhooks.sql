-- Phase 25: prompt-injection scan type + lifecycle webhooks
-- 1. Extend the scans.scanType enum so a collection can be scanned for
--    prompt-injection risks (LLM-backed endpoints).
ALTER TABLE `scans` MODIFY COLUMN `scanType` enum('full','quick','shadow_api','prompt_injection') NOT NULL;--> statement-breakpoint

-- 2. Lifecycle webhooks — user-registered HTTP endpoints that receive
--    scan.complete / finding.discovered / quota.warning / kill_switch.triggered
--    events with HMAC-SHA256 signatures.
CREATE TABLE `webhook_endpoints` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(1024) NOT NULL,
	`secret` varchar(128) NOT NULL,
	`events` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastDeliveryAt` timestamp,
	`lastStatus` int,
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE (now()),
	CONSTRAINT `webhook_endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `webhook_endpoints` (`userId`);--> statement-breakpoint

-- 3. Audit trail for every webhook delivery attempt (success or failure).
CREATE TABLE `webhook_deliveries` (
	`id` varchar(64) NOT NULL,
	`webhookId` varchar(64) NOT NULL,
	`event` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`status` int,
	`responseBody` text,
	`errorMessage` text,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `webhookId_idx` ON `webhook_deliveries` (`webhookId`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `webhook_deliveries` (`createdAt`);
