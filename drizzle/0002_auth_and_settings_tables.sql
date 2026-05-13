CREATE TABLE `audit_log` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_preferences` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`scanComplete` boolean NOT NULL DEFAULT true,
	`budgetAlerts` boolean NOT NULL DEFAULT true,
	`weeklyDigest` boolean NOT NULL DEFAULT true,
	`teamActivity` boolean NOT NULL DEFAULT true,
	`promotionalEmails` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` varchar(64),
	`razorpayPaymentId` varchar(255) NOT NULL,
	`razorpayOrderId` varchar(255),
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'INR',
	`status` enum('created','authorized','captured','failed','refunded','partially_refunded') NOT NULL DEFAULT 'created',
	`receipt` varchar(255),
	`description` text,
	`metadata` json,
	`refundAmount` decimal(10,2) DEFAULT '0',
	`refundStatus` enum('null','partial','full') DEFAULT 'null',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_razorpayPaymentId_unique` UNIQUE(`razorpayPaymentId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`razorpaySubscriptionId` varchar(255),
	`razorpayCustomerId` varchar(255),
	`status` enum('active','paused','cancelled','past_due','pending') NOT NULL DEFAULT 'pending',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelledAt` timestamp,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `subscriptions_razorpaySubscriptionId_unique` UNIQUE(`razorpaySubscriptionId`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`lastActiveAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','editor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `plan` enum('free','pro','enterprise') DEFAULT 'free' NOT NULL;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `audit_log` (`userId`);--> statement-breakpoint
CREATE INDEX `action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `audit_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `email_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `password_reset_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `expiresAt_idx` ON `password_reset_tokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `payments` (`userId`);--> statement-breakpoint
CREATE INDEX `subscriptionId_idx` ON `payments` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `razorpayPaymentId_idx` ON `payments` (`razorpayPaymentId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `payments` (`createdAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `razorpaySubscriptionId_idx` ON `subscriptions` (`razorpaySubscriptionId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `currentPeriodEnd_idx` ON `subscriptions` (`currentPeriodEnd`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `sessionToken_idx` ON `user_sessions` (`sessionToken`);--> statement-breakpoint
CREATE INDEX `expiresAt_idx` ON `user_sessions` (`expiresAt`);