-- Migration: Add invite_status and invite_last_checked_at columns to discord_servers
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

-- Add invite_status column with check constraint
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS invite_status text
    NOT NULL DEFAULT 'unknown'
    CHECK (invite_status IN ('valid', 'expired', 'unknown'));

-- Add invite_last_checked_at column
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS invite_last_checked_at timestamptz DEFAULT NULL;

-- Backfill existing rows (explicit update for safety in case DEFAULT was not applied)
UPDATE public.discord_servers
  SET invite_status = 'unknown'
  WHERE invite_status IS NULL;

-- Index for efficient filtering of non-expired approved servers
CREATE INDEX IF NOT EXISTS idx_discord_servers_invite_status
  ON public.discord_servers(invite_status, bumped_at DESC)
  WHERE status = 'approved';

-- Index for batch job: find approved servers needing validation (unknown or not recently checked)
CREATE INDEX IF NOT EXISTS idx_discord_servers_needs_validation
  ON public.discord_servers(invite_last_checked_at NULLS FIRST)
  WHERE status = 'approved' AND invite_status != 'expired';
