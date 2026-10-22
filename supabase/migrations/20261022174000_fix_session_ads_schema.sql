-- ============================================================================
-- Migration: Fix session_ads schema & RLS
-- Date: 2026-10-22
-- Reason:
--   session_ads had legacy NOT NULL column 'title' without default and was
--   missing 'sort_order' and button customization columns used by
--   SessionAdsManagement.tsx and the Discord bot.
-- ============================================================================

ALTER TABLE public.session_ads ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.session_ads ALTER COLUMN title SET DEFAULT NULL;

ALTER TABLE public.session_ads
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_button boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS button_label text DEFAULT 'ดูรายละเอียด',
  ADD COLUMN IF NOT EXISTS button_emoji text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_animated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS session_ads_sort_order_idx
  ON public.session_ads (sort_order ASC)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.set_session_ads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_ads_updated_at ON public.session_ads;
CREATE TRIGGER trg_session_ads_updated_at
  BEFORE UPDATE ON public.session_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_session_ads_updated_at();

ALTER TABLE public.session_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.session_ads;
CREATE POLICY "service role full access"
  ON public.session_ads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read session_ads" ON public.session_ads;
CREATE POLICY "authenticated read session_ads"
  ON public.session_ads FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated insert session_ads" ON public.session_ads;
CREATE POLICY "authenticated insert session_ads"
  ON public.session_ads FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated update session_ads" ON public.session_ads;
CREATE POLICY "authenticated update session_ads"
  ON public.session_ads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated delete session_ads" ON public.session_ads;
CREATE POLICY "authenticated delete session_ads"
  ON public.session_ads FOR DELETE
  TO authenticated
  USING (true);
