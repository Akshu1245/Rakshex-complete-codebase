-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id varchar(64) NOT NULL PRIMARY KEY,
  "userId" int NOT NULL,
  token varchar(255) NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_userId_idx ON password_reset_tokens ("userId");
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiresAt_idx ON password_reset_tokens ("expiresAt");

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id varchar(64) NOT NULL PRIMARY KEY,
  "userId" int NOT NULL,
  "sessionToken" varchar(255) NOT NULL UNIQUE,
  "ipAddress" varchar(45) NULL,
  "userAgent" text NULL,
  "lastActiveAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" timestamp NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_userId_idx ON user_sessions ("userId");
CREATE INDEX IF NOT EXISTS user_sessions_sessionToken_idx ON user_sessions ("sessionToken");
CREATE INDEX IF NOT EXISTS user_sessions_expiresAt_idx ON user_sessions ("expiresAt");

-- Email Preferences Table
CREATE TABLE IF NOT EXISTS email_preferences (
  id varchar(64) NOT NULL PRIMARY KEY,
  "userId" int NOT NULL UNIQUE,
  "scanComplete" BOOLEAN NOT NULL DEFAULT true,
  "budgetAlerts" BOOLEAN NOT NULL DEFAULT true,
  "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
  "teamActivity" BOOLEAN NOT NULL DEFAULT true,
  "promotionalEmails" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS email_preferences_userId_idx ON email_preferences ("userId");

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id varchar(64) NOT NULL PRIMARY KEY,
  "userId" int NOT NULL,
  action varchar(128) NOT NULL,
  details json NULL,
  "ipAddress" varchar(45) NULL,
  "userAgent" text NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_log_userId_idx ON audit_log ("userId");
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_createdAt_idx ON audit_log ("createdAt");
