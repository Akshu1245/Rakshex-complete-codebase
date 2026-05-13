-- Add TOTP secret column for two-factor authentication
ALTER TABLE `users` ADD `totpSecret` varchar(64);
