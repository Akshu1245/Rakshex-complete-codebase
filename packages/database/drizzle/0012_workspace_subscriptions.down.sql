DROP TABLE IF EXISTS "workspace_subscriptions";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_amount_minor_check";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_minor";
