CREATE TABLE `import_history` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `source` varchar(32) NOT NULL,
  `recordsImported` int NOT NULL DEFAULT 0,
  `recordsSkipped` int NOT NULL DEFAULT 0,
  `collectionsCreated` int NOT NULL DEFAULT 0,
  `errors` json,
  `result` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  INDEX `userId_idx` (`userId`),
  INDEX `source_idx` (`source`),
  INDEX `createdAt_idx` (`createdAt`)
);
