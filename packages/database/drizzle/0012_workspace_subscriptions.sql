-- Workspace-scoped Rakshex subscriptions and seat capacity.
-- Prices are stored in provider minor units (paise/cents), never floats.

CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL UNIQUE,
  "billing_owner_user_id" integer NOT NULL,
  "plan" "subscription_plan" DEFAULT 'pro' NOT NULL,
  "seat_count" integer DEFAULT 1 NOT NULL,
  "unit_amount_minor" integer DEFAULT 0 NOT NULL,
  "total_amount_minor" integer DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'INR' NOT NULL,
  "provider" varchar(32) DEFAULT 'razorpay' NOT NULL,
  "provider_subscription_id" varchar(255) UNIQUE,
  "provider_customer_id" varchar(255),
  "status" "subscription_status" DEFAULT 'pending' NOT NULL,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "cancelled_at" timestamp,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_subscriptions_seat_count_check"
    CHECK ("seat_count" >= 1 AND "seat_count" <= 500),
  CONSTRAINT "workspace_subscriptions_amount_check"
    CHECK ("unit_amount_minor" >= 0 AND "total_amount_minor" >= 0)
);

CREATE INDEX IF NOT EXISTS "workspace_subscriptions_workspace_idx"
  ON "workspace_subscriptions" ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_billing_owner_idx"
  ON "workspace_subscriptions" ("billing_owner_user_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_provider_subscription_idx"
  ON "workspace_subscriptions" ("provider_subscription_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_status_idx"
  ON "workspace_subscriptions" ("status");

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "amount_minor" integer DEFAULT 0 NOT NULL;

UPDATE "payments"
SET "amount_minor" = ROUND(("amount"::numeric) * 100)::integer
WHERE "amount_minor" = 0 AND ("amount"::numeric) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_amount_minor_check'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_amount_minor_check" CHECK ("amount_minor" >= 0);
  END IF;
END
$$;
