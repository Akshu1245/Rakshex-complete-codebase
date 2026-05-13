CREATE TABLE `vscode_activities` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`data` json,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vscode_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('active','paused','cancelled','past_due','pending','halted') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `collections` ADD `githubRepo` varchar(255);--> statement-breakpoint
ALTER TABLE `collections` ADD `lastScannedAt` timestamp;--> statement-breakpoint
ALTER TABLE `email_preferences` ADD `unsubscribeToken` varchar(64);--> statement-breakpoint
ALTER TABLE `kill_switch_settings` ADD `lastWarningSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `apiKey` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `scansRemaining` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `email_preferences` ADD CONSTRAINT `email_preferences_unsubscribeToken_unique` UNIQUE(`unsubscribeToken`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `vscode_activities` (`userId`);--> statement-breakpoint
CREATE INDEX `timestamp_idx` ON `vscode_activities` (`timestamp`);--> statement-breakpoint
CREATE INDEX `githubRepo_idx` ON `collections` (`githubRepo`);--> statement-breakpoint
CREATE INDEX `apiKey_idx` ON `users` (`apiKey`);