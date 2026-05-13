CREATE TABLE `collections` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`format` enum('postman','openapi') NOT NULL,
	`data` json NOT NULL,
	`totalRequests` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_reports` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`collectionId` varchar(64) NOT NULL,
	`reportType` enum('pci_dss','owasp','custom') NOT NULL,
	`complianceScore` decimal(5,2) NOT NULL,
	`totalRequirements` int NOT NULL,
	`metRequirements` int NOT NULL,
	`requirementsData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `compliance_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` varchar(64) NOT NULL,
	`scanId` varchar(64) NOT NULL,
	`collectionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`severity` enum('Critical','High','Medium','Low') NOT NULL,
	`category` varchar(255),
	`remediation` text,
	`status` enum('open','in-progress','resolved') NOT NULL DEFAULT 'open',
	`cweId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kill_switch_events` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('budget_set','triggered','auto_triggered','reset') NOT NULL,
	`budgetLimit` decimal(10,2),
	`currentSpend` decimal(10,2),
	`reason` text,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kill_switch_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kill_switch_settings` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`budgetLimitUSD` decimal(10,2) DEFAULT '100',
	`isActive` boolean NOT NULL DEFAULT false,
	`currentSpendUSD` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kill_switch_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `kill_switch_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_progress` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 1,
	`importCollectionCompleted` boolean NOT NULL DEFAULT false,
	`runScanCompleted` boolean NOT NULL DEFAULT false,
	`reviewFindingsCompleted` boolean NOT NULL DEFAULT false,
	`inviteTeamCompleted` boolean NOT NULL DEFAULT false,
	`setupComplianceCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `onboarding_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `onboarding_progress_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`collectionId` varchar(64) NOT NULL,
	`scanType` enum('full','quick','shadow_api') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL,
	`riskScore` decimal(5,2) DEFAULT '0',
	`riskLevel` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`totalFindings` int NOT NULL DEFAULT 0,
	`findingsData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shadow_apis` (
	`id` varchar(64) NOT NULL,
	`scanId` varchar(64) NOT NULL,
	`collectionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(16),
	`file` varchar(255),
	`line` int,
	`riskLevel` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`reason` text,
	`recommendation` text,
	`isDocumented` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shadow_apis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`memberEmail` varchar(320) NOT NULL,
	`memberUserId` int,
	`role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `token_usage` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`model` varchar(128) NOT NULL,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`thinkingTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`costUSD` decimal(10,6) DEFAULT '0',
	`date` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `collections` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `compliance_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `collectionId_idx` ON `compliance_reports` (`collectionId`);--> statement-breakpoint
CREATE INDEX `scanId_idx` ON `findings` (`scanId`);--> statement-breakpoint
CREATE INDEX `collectionId_idx` ON `findings` (`collectionId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `findings` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `kill_switch_events` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `kill_switch_settings` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `onboarding_progress` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `scans` (`userId`);--> statement-breakpoint
CREATE INDEX `collectionId_idx` ON `scans` (`collectionId`);--> statement-breakpoint
CREATE INDEX `scanId_idx` ON `shadow_apis` (`scanId`);--> statement-breakpoint
CREATE INDEX `collectionId_idx` ON `shadow_apis` (`collectionId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `shadow_apis` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `team_members` (`userId`);--> statement-breakpoint
CREATE INDEX `memberEmail_idx` ON `team_members` (`memberEmail`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `token_usage` (`userId`);--> statement-breakpoint
CREATE INDEX `model_idx` ON `token_usage` (`model`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `token_usage` (`date`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);