-- Roll back 0031: drop owner + rotation grace columns
ALTER TABLE "control_plane_credentials" DROP COLUMN IF EXISTS "grace_expires_at";
ALTER TABLE "control_plane_credentials" DROP COLUMN IF EXISTS "previous_fingerprint";
ALTER TABLE "control_plane_credentials" DROP COLUMN IF EXISTS "previous_encrypted_value";
ALTER TABLE "control_plane_credentials" DROP COLUMN IF EXISTS "owner";
