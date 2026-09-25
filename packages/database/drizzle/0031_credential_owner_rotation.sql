-- Credential owner + rotation grace window on control_plane_credentials
ALTER TABLE "control_plane_credentials" ADD COLUMN IF NOT EXISTS "owner" varchar(255);
ALTER TABLE "control_plane_credentials" ADD COLUMN IF NOT EXISTS "previous_encrypted_value" text;
ALTER TABLE "control_plane_credentials" ADD COLUMN IF NOT EXISTS "previous_fingerprint" varchar(128);
ALTER TABLE "control_plane_credentials" ADD COLUMN IF NOT EXISTS "grace_expires_at" timestamp;
CREATE INDEX IF NOT EXISTS "control_plane_credentials_grace_idx" ON "control_plane_credentials" ("grace_expires_at");
