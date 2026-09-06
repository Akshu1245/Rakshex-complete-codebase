-- Add ElevenLabs as a first-class control-plane provider for voice gateway enforcement.
ALTER TYPE "control_plane_provider" ADD VALUE IF NOT EXISTS 'elevenlabs';
