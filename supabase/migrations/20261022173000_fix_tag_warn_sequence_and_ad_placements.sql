-- ============================================================================
-- Migration: Fix tag_warn_logs sequence & ad_placements schema
-- Date: 2026-10-22
-- Reason:
--   1. tag_warn_logs.sequence was missing sequence generator/default in Supabase 2,
--      causing "null value in column 'sequence' violates not-null constraint".
--   2. ad_placements in Supabase 2 had legacy schema (code/name) instead of the
--      system design (key, display_name, delivery_mode, sort_order).
-- ============================================================================

-- 1. tag_warn_logs sequence and auto-numbering
CREATE SEQUENCE IF NOT EXISTS public.tag_warn_logs_sequence_seq;
ALTER SEQUENCE public.tag_warn_logs_sequence_seq OWNED BY public.tag_warn_logs.sequence;
ALTER TABLE public.tag_warn_logs ALTER COLUMN sequence SET DEFAULT nextval('public.tag_warn_logs_sequence_seq');

-- Synchronize sequence to current max
SELECT setval('public.tag_warn_logs_sequence_seq', COALESCE((SELECT MAX(sequence) FROM public.tag_warn_logs), 0));

-- Trigger to guarantee sequence assignment even if explicit NULL or 0 is passed
CREATE OR REPLACE FUNCTION public.set_tag_warn_logs_sequence()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sequence IS NULL OR NEW.sequence = 0 THEN
    NEW.sequence := nextval('public.tag_warn_logs_sequence_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tag_warn_logs_sequence ON public.tag_warn_logs;
CREATE TRIGGER trg_set_tag_warn_logs_sequence
  BEFORE INSERT ON public.tag_warn_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tag_warn_logs_sequence();

-- 2. ad_placements & ad_placement_items alignment
DROP TABLE IF EXISTS public.ad_placement_items CASCADE;
DROP TABLE IF EXISTS public.ad_placements CASCADE;

CREATE TABLE public.ad_placements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'),
  display_name  text        NOT NULL,
  description   text,
  delivery_mode text        NOT NULL DEFAULT 'all'
                            CHECK (delivery_mode IN ('all', 'random_one', 'ordered')),
  api_key_hash  text,
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_placements_key_idx
  ON public.ad_placements (key);

CREATE INDEX IF NOT EXISTS ad_placements_sort_order_idx
  ON public.ad_placements (sort_order ASC);

CREATE OR REPLACE FUNCTION public.set_ad_placements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_placements_updated_at ON public.ad_placements;
CREATE TRIGGER trg_ad_placements_updated_at
  BEFORE UPDATE ON public.ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.set_ad_placements_updated_at();

CREATE TABLE public.ad_placement_items (
  placement_id  uuid    NOT NULL REFERENCES public.ad_placements(id) ON DELETE CASCADE,
  ad_id         uuid    NOT NULL REFERENCES public.session_ads(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (placement_id, ad_id)
);

CREATE INDEX IF NOT EXISTS ad_placement_items_placement_sort_idx
  ON public.ad_placement_items (placement_id, sort_order ASC);

-- RLS: ad_placements
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_placements_service_role_all" ON public.ad_placements;
CREATE POLICY "ad_placements_service_role_all"
  ON public.ad_placements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "ad_placements_admin_all" ON public.ad_placements;
CREATE POLICY "ad_placements_admin_all"
  ON public.ad_placements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "ad_placements_authenticated_read" ON public.ad_placements;
CREATE POLICY "ad_placements_authenticated_read"
  ON public.ad_placements FOR SELECT
  TO authenticated
  USING (true);

-- RLS: ad_placement_items
ALTER TABLE public.ad_placement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_placement_items_service_role_all" ON public.ad_placement_items;
CREATE POLICY "ad_placement_items_service_role_all"
  ON public.ad_placement_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "ad_placement_items_admin_all" ON public.ad_placement_items;
CREATE POLICY "ad_placement_items_admin_all"
  ON public.ad_placement_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "ad_placement_items_authenticated_read" ON public.ad_placement_items;
CREATE POLICY "ad_placement_items_authenticated_read"
  ON public.ad_placement_items FOR SELECT
  TO authenticated
  USING (true);

-- Seed session_webhook placement
INSERT INTO public.ad_placements (key, display_name, description, delivery_mode, is_active, sort_order)
VALUES (
  'session_webhook',
  'ระบบหาเพื่อน',
  'โฆษณาที่แทรกใน Discord Component v2 ทุกครั้งที่มีการโพสต์หาเพื่อนลงห้อง',
  'all',
  true,
  0
)
ON CONFLICT (key) DO NOTHING;
