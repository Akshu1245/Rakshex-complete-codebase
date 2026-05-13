-- Sprint 6: configurable alert rules + Discord/PagerDuty integrations.
CREATE TABLE IF NOT EXISTS `alert_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(192) NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `conditions` json NOT NULL,
  `window` enum('1h','24h','7d') NOT NULL DEFAULT '24h',
  `cooldownMinutes` int NOT NULL DEFAULT 30,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `channels` json NOT NULL,
  `lastFiredAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `enabled_idx` (`enabled`),
  CONSTRAINT `fk_alert_rules_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `alert_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `ruleId` int NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL,
  `summary` varchar(512) NOT NULL,
  `matched` json NOT NULL,
  `snapshots` json NOT NULL,
  `channel` varchar(32) NOT NULL,
  `delivered` boolean NOT NULL DEFAULT false,
  `statusCode` int NULL,
  `errorMessage` varchar(512) NULL,
  `firedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `ruleId_idx` (`ruleId`),
  KEY `firedAt_idx` (`firedAt`),
  CONSTRAINT `fk_alert_events_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_alert_events_rule`
    FOREIGN KEY (`ruleId`) REFERENCES `alert_rules`(`id`) ON DELETE CASCADE
);
