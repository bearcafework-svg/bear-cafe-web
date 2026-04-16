
-- Add external sync tracking columns to tag_warn_cancel_requests
ALTER TABLE public.tag_warn_cancel_requests
  ADD COLUMN IF NOT EXISTS external_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS external_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS external_sync_error text;
