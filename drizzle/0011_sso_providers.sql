-- Sprint 6 / Domain 5: SSO providers + pending logins.
CREATE TABLE IF NOT EXISTS `sso_providers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(192) NOT NULL,
  `kind` enum('oidc','saml') NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `config` json NOT NULL,
  `emailDomain` varchar(256) NULL,
  `defaultRole` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `kind_idx` (`kind`),
  KEY `enabled_idx` (`enabled`),
  CONSTRAINT `fk_sso_providers_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `sso_login_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `state` varchar(128) NOT NULL,
  `providerId` int NOT NULL,
  `codeVerifier` varchar(256) NULL,
  `nonce` varchar(128) NULL,
  `redirectTo` varchar(512) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `state_unique` (`state`),
  KEY `state_idx` (`state`),
  KEY `expiresAt_idx` (`expiresAt`),
  CONSTRAINT `fk_sso_login_provider`
    FOREIGN KEY (`providerId`) REFERENCES `sso_providers`(`id`) ON DELETE CASCADE
);
