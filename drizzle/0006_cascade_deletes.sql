-- 0006_cascade_deletes.sql
-- Add explicit `ON DELETE CASCADE` foreign keys for tables semantically
-- owned by a parent (`users`, `scans`, `collections`, `webhook_endpoints`).
--
-- Before this migration the application code in `db.ts` already did the
-- right thing on the happy path — `deleteCollection` removes its scans
-- and findings transactionally — but a manual `DELETE FROM users WHERE id=X`
-- run from the DB CLI (or a future "GDPR delete-my-account" flow) would
-- leave orphans. Foreign keys make the database itself enforce the
-- invariant so application bugs can't drift.
--
-- IMPORTANT: this migration ALTERs existing tables. If the database
-- already has orphan rows (child rows whose parent has been deleted),
-- `ADD CONSTRAINT` will fail. The cleanup queries below are idempotent
-- and safe to run before applying the constraint.

-- ── Pre-flight: clean up existing orphans ─────────────────────────────────
DELETE f FROM `findings` f LEFT JOIN `users` u ON u.id = f.userId WHERE u.id IS NULL;
DELETE f FROM `findings` f LEFT JOIN `scans` s ON s.id = f.scanId WHERE s.id IS NULL;
DELETE f FROM `findings` f LEFT JOIN `collections` c ON c.id = f.collectionId WHERE c.id IS NULL;
DELETE s FROM `scans` s LEFT JOIN `users` u ON u.id = s.userId WHERE u.id IS NULL;
DELETE s FROM `scans` s LEFT JOIN `collections` c ON c.id = s.collectionId WHERE c.id IS NULL;
DELETE sa FROM `shadow_apis` sa LEFT JOIN `users` u ON u.id = sa.userId WHERE u.id IS NULL;
DELETE sa FROM `shadow_apis` sa LEFT JOIN `scans` s ON s.id = sa.scanId WHERE s.id IS NULL;
DELETE sa FROM `shadow_apis` sa LEFT JOIN `collections` c ON c.id = sa.collectionId WHERE c.id IS NULL;
DELETE tu FROM `token_usage` tu LEFT JOIN `users` u ON u.id = tu.userId WHERE u.id IS NULL;
DELETE p FROM `payments` p LEFT JOIN `users` u ON u.id = p.userId WHERE u.id IS NULL;
DELETE us FROM `user_sessions` us LEFT JOIN `users` u ON u.id = us.userId WHERE u.id IS NULL;
DELETE va FROM `vscode_activities` va LEFT JOIN `users` u ON u.id = va.userId WHERE u.id IS NULL;
DELETE al FROM `audit_log` al LEFT JOIN `users` u ON u.id = al.userId WHERE u.id IS NULL;
DELETE prt FROM `password_reset_tokens` prt LEFT JOIN `users` u ON u.id = prt.userId WHERE u.id IS NULL;
DELETE c FROM `collections` c LEFT JOIN `users` u ON u.id = c.userId WHERE u.id IS NULL;
DELETE cr FROM `compliance_reports` cr LEFT JOIN `users` u ON u.id = cr.userId WHERE u.id IS NULL;
DELETE oss FROM `onboarding_progress` oss LEFT JOIN `users` u ON u.id = oss.userId WHERE u.id IS NULL;
DELETE ks FROM `kill_switch_settings` ks LEFT JOIN `users` u ON u.id = ks.userId WHERE u.id IS NULL;
DELETE kse FROM `kill_switch_events` kse LEFT JOIN `users` u ON u.id = kse.userId WHERE u.id IS NULL;
DELETE ep FROM `email_preferences` ep LEFT JOIN `users` u ON u.id = ep.userId WHERE u.id IS NULL;
DELETE we FROM `webhook_endpoints` we LEFT JOIN `users` u ON u.id = we.userId WHERE u.id IS NULL;
DELETE wd FROM `webhook_deliveries` wd LEFT JOIN `webhook_endpoints` we ON we.id = wd.webhookId WHERE we.id IS NULL;

-- ── Cascade FKs (user-owned + scan/collection-owned) ──────────────────────
ALTER TABLE `collections` ADD CONSTRAINT `fk_collections_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `scans` ADD CONSTRAINT `fk_scans_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `scans` ADD CONSTRAINT `fk_scans_collection` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE CASCADE;
ALTER TABLE `findings` ADD CONSTRAINT `fk_findings_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `findings` ADD CONSTRAINT `fk_findings_scan` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE CASCADE;
ALTER TABLE `findings` ADD CONSTRAINT `fk_findings_collection` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE CASCADE;
ALTER TABLE `shadow_apis` ADD CONSTRAINT `fk_shadow_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `shadow_apis` ADD CONSTRAINT `fk_shadow_scan` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE CASCADE;
ALTER TABLE `shadow_apis` ADD CONSTRAINT `fk_shadow_collection` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE CASCADE;
ALTER TABLE `token_usage` ADD CONSTRAINT `fk_token_usage_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `fk_payments_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `user_sessions` ADD CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `vscode_activities` ADD CONSTRAINT `fk_vscode_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `audit_log` ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `compliance_reports` ADD CONSTRAINT `fk_compliance_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `onboarding_progress` ADD CONSTRAINT `fk_onboarding_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `kill_switch_settings` ADD CONSTRAINT `fk_kill_switch_settings_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `kill_switch_events` ADD CONSTRAINT `fk_kill_switch_events_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `email_preferences` ADD CONSTRAINT `fk_email_prefs_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `webhook_endpoints` ADD CONSTRAINT `fk_webhook_endpoints_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `fk_webhook_deliveries_endpoint` FOREIGN KEY (`webhookId`) REFERENCES `webhook_endpoints`(`id`) ON DELETE CASCADE;
