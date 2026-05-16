-- Migration: Add refresh token rotation columns to user_sessions
-- 
-- Adds: refreshTokenHash (SHA-256 of refresh token), lastUsedAt,
-- isRevoked (boolean for fast lookups), and an index on refreshTokenHash.
-- 
-- Rollback: ALTER TABLE user_sessions DROP COLUMN refreshTokenHash,
--   DROP COLUMN lastUsedAt, DROP COLUMN isRevoked,
--   DROP INDEX refreshTokenHash_idx;

ALTER TABLE user_sessions
  ADD COLUMN refreshTokenHash VARCHAR(64) DEFAULT NULL
    AFTER sessionToken,
  ADD COLUMN lastUsedAt TIMESTAMP NULL DEFAULT NULL
    AFTER lastActiveAt,
  ADD COLUMN isRevoked BOOLEAN NOT NULL DEFAULT FALSE
    AFTER revokedAt,
  ADD INDEX refreshTokenHash_idx (refreshTokenHash);

-- Backfill: mark any sessions without a refresh token hash as expired
-- since they were created before rotation was introduced. Users will
-- need to log in again to get new rotating refresh tokens.
UPDATE user_sessions
  SET revokedAt = NOW(), isRevoked = TRUE
  WHERE refreshTokenHash IS NULL AND revokedAt IS NULL;
