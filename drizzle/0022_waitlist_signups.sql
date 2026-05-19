/**
 * Migration: add waitlist_signups table.
 *
 * Captures public marketing waitlist email captures from the landing
 * page. Operators can query directly or be notified via the configured
 * SMTP admin notification (see server/email.ts).
 *
 * Rollback: DROP TABLE waitlist_signups;
 */

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  source VARCHAR(64) NULL,
  referrer VARCHAR(1024) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX waitlist_email_idx (email),
  INDEX waitlist_created_at_idx (created_at)
);
