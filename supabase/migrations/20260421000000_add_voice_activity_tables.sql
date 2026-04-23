-- Voice Activity Points: new tables only
-- DO NOT modify user_points or profiles

-- 1. Persistent notification buffer (replaces in-memory buffer)
CREATE TABLE IF NOT EXISTS public.user_notify_buffer (
  user_id      TEXT PRIMARY KEY,
  pending_points INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Processed events (anti-duplicate, idempotency)
CREATE TABLE IF NOT EXISTS public.processed_events (
  event_id   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_processed_events_created_at
  ON public.processed_events (created_at);

-- RLS: service role only (called from Edge Function with service key)
ALTER TABLE public.user_notify_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_notify_buffer"
  ON public.user_notify_buffer FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_processed_events"
  ON public.processed_events FOR ALL TO service_role USING (true) WITH CHECK (true);
