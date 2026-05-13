-- Sprint 6 / Domain 6: Workspaces + RBAC.
CREATE TABLE IF NOT EXISTS `workspaces` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(64) NOT NULL UNIQUE,
  `name` varchar(192) NOT NULL,
  `ownerUserId` int NOT NULL,
  `isPersonal` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ownerUserId_idx` (`ownerUserId`),
  KEY `slug_idx` (`slug`),
  CONSTRAINT `fk_workspaces_owner`
    FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `workspace_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workspaceId` int NOT NULL,
  `userId` int NOT NULL,
  `role` enum('owner','admin','editor','viewer') NOT NULL DEFAULT 'viewer',
  `active` boolean NOT NULL DEFAULT true,
  `invitedBy` int NULL,
  `invitedAt` timestamp NULL,
  `joinedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workspace_user_uniq` (`workspaceId`, `userId`),
  KEY `userId_idx` (`userId`),
  CONSTRAINT `fk_wm_workspace`
    FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wm_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `workspace_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workspaceId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
  `token` varchar(128) NOT NULL UNIQUE,
  `invitedBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workspaceId_idx` (`workspaceId`),
  KEY `email_idx` (`email`),
  KEY `token_idx` (`token`),
  CONSTRAINT `fk_wi_workspace`
    FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wi_inviter`
    FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
