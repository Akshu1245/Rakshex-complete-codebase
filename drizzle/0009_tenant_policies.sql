-- Sprint 6: YAML-DSL tenant policies.
CREATE TABLE IF NOT EXISTS `tenant_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(192) NOT NULL,
  `yaml` text NOT NULL,
  `compiled` json NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `appliesTo` varchar(256) NOT NULL DEFAULT 'all',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `appliesTo_idx` (`appliesTo`),
  CONSTRAINT `fk_tenant_policies_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
