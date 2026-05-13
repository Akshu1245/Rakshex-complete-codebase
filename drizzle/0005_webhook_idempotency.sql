-- Phase 26: inbound webhook idempotency table
-- Razorpay (and Stripe) retry the same event for ~24h until they receive a
-- 2xx ACK. Without idempotent processing, a single payment can upgrade a
-- user's plan, fire side effects, and dispatch outbound webhooks multiple
-- times. We persist the provider's event id (`evt_*`) and short-circuit
-- duplicate deliveries before any state changes are made.

CREATE TABLE `processed_webhook_events` (
	`id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processed_webhook_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `provider_event_idx` ON `processed_webhook_events` (`provider`,`eventId`);
