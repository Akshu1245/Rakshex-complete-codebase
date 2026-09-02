CREATE TABLE IF NOT EXISTS "waitlist_growth" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "evaluation_type" varchar(64) DEFAULT 'Team pilot' NOT NULL,
  "source" varchar(128) DEFAULT 'waitlist' NOT NULL,
  "role" varchar(96),
  "company" varchar(192),
  "agent_stage" varchar(32),
  "providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "frameworks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "monthly_spend" varchar(32),
  "pain" varchar(128),
  "pilot_interest" varchar(32),
  "design_partner" boolean DEFAULT false NOT NULL,
  "referral_code" varchar(24) NOT NULL,
  "referred_by_code" varchar(24),
  "referral_count" integer DEFAULT 0 NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "verify_token_hash" varchar(64),
  "verify_expires_at" timestamp,
  "verified_at" timestamp,
  "qualification_score" integer DEFAULT 0 NOT NULL,
  "fraud_score" integer DEFAULT 0 NOT NULL,
  "flagged" boolean DEFAULT false NOT NULL,
  "signup_ip_hash" varchar(64),
  "user_agent_hash" varchar(64),
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "utm_source" varchar(128),
  "utm_medium" varchar(128),
  "utm_campaign" varchar(192),
  "utm_content" varchar(192),
  "referrer" varchar(1024),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "waitlist_growth_email_unique" UNIQUE("email"),
  CONSTRAINT "waitlist_growth_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_growth_created_idx" ON "waitlist_growth" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_growth_verified_idx" ON "waitlist_growth" USING btree ("verified");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_growth_source_idx" ON "waitlist_growth" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_growth_ip_idx" ON "waitlist_growth" USING btree ("signup_ip_hash", "created_at");
