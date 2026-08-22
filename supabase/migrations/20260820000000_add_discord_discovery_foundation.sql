-- Migration: Add Discord Discovery Foundation (server_saves, server_discovery_events, trending ranking RPC)
-- Date: 2026-08-20
-- Plan: Plan 1 — Discord Discovery Foundation (Phase 1)

-- ============================================================================
-- 1. ตารางบันทึกเซิร์ฟเวอร์ (Server Saves)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.server_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  user_id text NOT NULL, -- Discord User ID
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_server_saves_user_server UNIQUE (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_saves_user ON public.server_saves(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_saves_server ON public.server_saves(server_id);

ALTER TABLE public.server_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view save counts" ON public.server_saves;
CREATE POLICY "Anyone can view save counts"
  ON public.server_saves FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can save servers for themselves" ON public.server_saves;
CREATE POLICY "Users can save servers for themselves"
  ON public.server_saves FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT discord_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can remove their own saved servers" ON public.server_saves;
CREATE POLICY "Users can remove their own saved servers"
  ON public.server_saves FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT discord_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 2. ตารางเก็บ Event เพื่อการวิเคราะห์ (Discovery Events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.server_discovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'view', 'click', 'save', 'unsave', 'search', 'bump'
  server_id uuid REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  user_id text, -- Discord ID (nullable สำหรับ guest)
  session_id text, -- Anonymous Session / Device hash
  metadata jsonb DEFAULT '{}'::jsonb, -- e.g. { "query": "อนิเมะ", "category": "Gaming" }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_events_type_date 
  ON public.server_discovery_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_events_server_date 
  ON public.server_discovery_events(server_id, created_at DESC);

ALTER TABLE public.server_discovery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert discovery events" ON public.server_discovery_events;
CREATE POLICY "Allow public insert discovery events"
  ON public.server_discovery_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view discovery events" ON public.server_discovery_events;
CREATE POLICY "Only admins can view discovery events"
  ON public.server_discovery_events FOR SELECT
  TO authenticated
  USING (public.is_owner() OR public.has_page_access('discord-servers'));

-- ============================================================================
-- 3. Atomic RPC: Toggle Server Save
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_server_save(_server_id uuid, _user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
  v_total_saves integer;
BEGIN
  -- ตรวจสอบว่าเคยบันทึกไว้แล้วหรือไม่
  SELECT EXISTS(
    SELECT 1 FROM public.server_saves WHERE server_id = _server_id AND user_id = _user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- ถ้าเคยมีอยู่แล้ว ให้ลบออก (Unsave)
    DELETE FROM public.server_saves WHERE server_id = _server_id AND user_id = _user_id;

    -- บันทึก Event
    INSERT INTO public.server_discovery_events (event_type, server_id, user_id)
    VALUES ('unsave', _server_id, _user_id);

    SELECT COUNT(*) INTO v_total_saves FROM public.server_saves WHERE server_id = _server_id;
    RETURN jsonb_build_object('saved', false, 'total_saves', v_total_saves);
  ELSE
    -- ถ้ายังไม่เคย ให้บันทึกเพิ่ม (Save)
    INSERT INTO public.server_saves (server_id, user_id)
    VALUES (_server_id, _user_id)
    ON CONFLICT DO NOTHING;

    -- บันทึก Event
    INSERT INTO public.server_discovery_events (event_type, server_id, user_id)
    VALUES ('save', _server_id, _user_id);

    SELECT COUNT(*) INTO v_total_saves FROM public.server_saves WHERE server_id = _server_id;
    RETURN jsonb_build_object('saved', true, 'total_saves', v_total_saves);
  END IF;
END;
$$;

-- ============================================================================
-- 4. RPC Function: คำนวณ Discovery Score และ Growth Rate (Trending / Rising Engine)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_discovery_trending_scores(integer);
DROP FUNCTION IF EXISTS public.get_discovery_trending_scores();

CREATE OR REPLACE FUNCTION public.get_discovery_trending_scores(p_days integer DEFAULT 7)
RETURNS TABLE (
  server_id uuid,
  discovery_score numeric,
  recent_clicks bigint,
  recent_saves bigint,
  previous_clicks bigint,
  previous_saves bigint,
  growth_rate numeric,
  is_new_breakout boolean,
  is_rising boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH stats AS (
    SELECT 
      ds.id AS s_id,
      -- Current Period (0 to 7 days)
      COALESCE((
        SELECT SUM(scs.click_count) 
        FROM public.server_click_stats scs 
        WHERE scs.server_id = ds.id AND scs.stat_date >= (CURRENT_DATE - p_days)
      ), 0) AS clicks_curr,
      (
        SELECT COUNT(*) 
        FROM public.server_saves ss 
        WHERE ss.server_id = ds.id AND ss.created_at >= now() - (p_days || ' days')::interval
      ) AS saves_curr,
      (
        SELECT COUNT(*) 
        FROM public.discord_server_bumps dsb 
        WHERE dsb.server_id = ds.id AND dsb.created_at >= now() - (p_days || ' days')::interval
      ) AS bumps_curr,
      
      -- Previous Period (7 to 14 days)
      COALESCE((
        SELECT SUM(scs.click_count) 
        FROM public.server_click_stats scs 
        WHERE scs.server_id = ds.id 
          AND scs.stat_date >= (CURRENT_DATE - (p_days * 2)) 
          AND scs.stat_date < (CURRENT_DATE - p_days)
      ), 0) AS clicks_prev,
      (
        SELECT COUNT(*) 
        FROM public.server_saves ss 
        WHERE ss.server_id = ds.id 
          AND ss.created_at >= now() - ((p_days * 2) || ' days')::interval
          AND ss.created_at < now() - (p_days || ' days')::interval
      ) AS saves_prev,

      EXTRACT(EPOCH FROM (now() - COALESCE(ds.bumped_at, ds.created_at))) / 3600 AS hours_since_bump
    FROM public.discord_servers ds
    WHERE ds.status = 'approved' AND ds.invite_status != 'expired'
  ),
  calculated AS (
    SELECT 
      s_id,
      clicks_curr,
      saves_curr,
      clicks_prev,
      saves_prev,
      (clicks_curr * 1.0 + saves_curr * 3.0) AS engagement_curr,
      (clicks_prev * 1.0 + saves_prev * 3.0) AS engagement_prev,
      ROUND(
        (clicks_curr * 3.0 + saves_curr * 5.0 + bumps_curr * 4.0) / 
        POWER((hours_since_bump + 2), 0.5)::numeric,
        2
      ) AS disc_score
    FROM stats
  )
  SELECT 
    s_id AS server_id,
    disc_score AS discovery_score,
    clicks_curr AS recent_clicks,
    saves_curr AS recent_saves,
    clicks_prev AS previous_clicks,
    saves_prev AS previous_saves,
    -- Rule 6: When previous = 0, growth_rate must be NULL (not 100%)
    CASE 
      WHEN engagement_prev = 0 THEN NULL
      ELSE ROUND(((engagement_curr - engagement_prev)::numeric / engagement_prev::numeric), 4)
    END AS growth_rate,
    -- Rule 6: is_new_breakout is true if previous was 0 and current engagement meets minimum threshold (>= 8)
    (engagement_prev = 0 AND engagement_curr >= 8) AS is_new_breakout,
    -- Rule 5 & 7: is_rising requires minimum sample AND (growth >= 50% OR is_new_breakout)
    (
      (engagement_curr >= 8 OR clicks_curr >= 5 OR saves_curr >= 2)
      AND (
        (engagement_prev = 0 AND engagement_curr >= 8)
        OR (engagement_prev > 0 AND (engagement_curr - engagement_prev)::numeric / engagement_prev::numeric >= 0.50)
      )
    ) AS is_rising
  FROM calculated;
$$;
