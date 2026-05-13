-- Add pending TOTP secret columns for persistent 2FA setup
ALTER TABLE `users` ADD `pendingTotpSecret` varchar(64);
ALTER TABLE `users` ADD `pendingTotpExpiresAt` timestamp;
