ALTER TABLE public.tag_warn_cancel_requests
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_sync_error TEXT;

ALTER TABLE public.tag_warn_cancel_requests
  ADD CONSTRAINT tag_warn_cancel_requests_external_sync_status_check
  CHECK (external_sync_status IN ('pending', 'success', 'failed'));
