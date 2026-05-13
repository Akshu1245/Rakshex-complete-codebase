-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `token` varchar(255) NOT NULL UNIQUE,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `password_reset_tokens_userId_idx` (`userId`),
  INDEX `password_reset_tokens_token_idx` (`token`),
  INDEX `password_reset_tokens_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Sessions Table
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `sessionToken` varchar(255) NOT NULL UNIQUE,
  `ipAddress` varchar(45) NULL,
  `userAgent` text NULL,
  `lastActiveAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revokedAt` timestamp NULL,
  INDEX `user_sessions_userId_idx` (`userId`),
  INDEX `user_sessions_sessionToken_idx` (`sessionToken`),
  INDEX `user_sessions_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Preferences Table
CREATE TABLE IF NOT EXISTS `email_preferences` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `userId` int NOT NULL UNIQUE,
  `scanComplete` boolean NOT NULL DEFAULT true,
  `budgetAlerts` boolean NOT NULL DEFAULT true,
  `weeklyDigest` boolean NOT NULL DEFAULT true,
  `teamActivity` boolean NOT NULL DEFAULT true,
  `promotionalEmails` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `email_preferences_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `action` varchar(128) NOT NULL,
  `details` json NULL,
  `ipAddress` varchar(45) NULL,
  `userAgent` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `audit_log_userId_idx` (`userId`),
  INDEX `audit_log_action_idx` (`action`),
  INDEX `audit_log_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
