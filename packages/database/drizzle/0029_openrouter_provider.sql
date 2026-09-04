-- Add OpenRouter as a first-class control-plane provider so gateway
-- enforcement, provider accounts, credentials, price versions, and settled
-- attribution can reference it.
--
-- PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long
-- as the new value is not used in the same transaction. This migration only
-- adds the value; no row in this file references it.
ALTER TYPE "control_plane_provider" ADD VALUE IF NOT EXISTS 'openrouter';
