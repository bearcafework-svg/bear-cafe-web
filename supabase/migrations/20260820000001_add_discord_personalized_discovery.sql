-- Migration: Add Personalized Recommendation Engine (Plan 2)
-- Date: 2026-08-20
-- Plan: Plan 2 — Personalized Discovery

-- ============================================================================
-- 1. Index ประสิทธิภาพสำหรับการคำนวณ User Interest Profile
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_discovery_events_user_date 
  ON public.server_discovery_events(user_id, created_at DESC);

-- ============================================================================
-- 2. RPC Function: Personalized Recommendation Engine (Rule + Weighted Score)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_personalized_recommendations(integer);
DROP FUNCTION IF EXISTS public.get_personalized_recommendations();

CREATE OR REPLACE FUNCTION public.get_personalized_recommendations(p_limit integer DEFAULT 12)
RETURNS TABLE (
  server_id uuid,
  recommendation_score numeric,
  recommendation_reason text,
  is_exploration boolean,
  user_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_user_discord_id text;
  v_meaningful_evidence numeric := 0;
  v_confidence numeric := 0;
  v_user_state text := 'NEW';
  v_max_interest numeric := 1.0;
  v_clamped_limit integer;
BEGIN
  -- 1. Clamp Limit ป้องกัน Abuse
  v_clamped_limit := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);

  -- 2. ตรวจสอบ Authenticated User (Security: ไม่เชื่อถือ user_id จาก Client)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NOT NULL THEN
    SELECT discord_id INTO v_user_discord_id 
    FROM public.profiles 
    WHERE id = v_auth_uid;
  END IF;

  -- ==========================================================================
  -- CASE A: GUEST USER (Option A: Secure General Discovery / Trending)
  -- ==========================================================================
  IF v_user_discord_id IS NULL THEN
    RETURN QUERY
    WITH general_candidates AS (
      SELECT 
        ds.id AS c_server_id,
        ROUND(
          (1.0 - (1.0 / (1.0 + (COALESCE(ts.discovery_score, 0) / 15.0)))) * 0.70 +
          EXP(-EXTRACT(EPOCH FROM (now() - ds.created_at)) / (14.0 * 86400))::numeric * 0.30,
          4
        ) AS c_score,
        '🔥 กำลังได้รับความสนใจในขณะนี้'::text AS c_reason,
        false AS c_is_exploration
      FROM public.discord_servers ds
      LEFT JOIN public.get_discovery_trending_scores(7) ts ON ts.server_id = ds.id
      WHERE ds.status = 'approved' AND ds.invite_status != 'expired'
      ORDER BY c_score DESC, ds.bumped_at DESC
      LIMIT v_clamped_limit
    )
    SELECT 
      c_server_id AS server_id,
      c_score AS recommendation_score,
      c_reason AS recommendation_reason,
      c_is_exploration AS is_exploration,
      'NEW'::text AS user_state
    FROM general_candidates;
    RETURN;
  END IF;

  -- ==========================================================================
  -- CASE B: AUTHENTICATED USER (Personalized Recommendation Flow)
  -- ==========================================================================

  -- 3. คำนวณ Meaningful Evidence Count (Lookback 30 วัน, Half-life 7 วัน)
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN sde.event_type = 'save' THEN 1.0
        WHEN sde.event_type = 'click' THEN 1.0
        WHEN sde.event_type = 'view' THEN 0.8
        WHEN sde.event_type = 'rating' THEN 0.8
        WHEN sde.event_type = 'search' THEN 0.5
        ELSE 0.0
      END * POWER(2.0, -EXTRACT(EPOCH FROM (now() - sde.created_at)) / (7.0 * 86400))
    ), 0)
  INTO v_meaningful_evidence
  FROM public.server_discovery_events sde
  WHERE sde.user_id = v_user_discord_id
    AND sde.created_at >= now() - interval '30 days';

  -- 4. กำหนด User State & Interest Confidence
  IF v_meaningful_evidence < 3.0 THEN
    v_user_state := 'NEW';
    v_confidence := 0.0;
  ELSIF v_meaningful_evidence < 8.0 THEN
    v_user_state := 'EARLY';
    v_confidence := ROUND(v_meaningful_evidence / 8.0, 4);
  ELSE
    v_user_state := 'ESTABLISHED';
    v_confidence := 1.0;
  END IF;

  -- 5. สร้าง User Category Interest Profile Table (ชั่วคราวใน Memory)
  CREATE TEMP TABLE IF NOT EXISTS temp_user_category_interest (
    category_id uuid PRIMARY KEY,
    interest_score numeric,
    category_name text
  ) ON COMMIT DROP;

  TRUNCATE temp_user_category_interest;

  INSERT INTO temp_user_category_interest (category_id, interest_score, category_name)
  SELECT 
    ds.category_id,
    COALESCE(SUM(
      CASE 
        WHEN sde.event_type = 'save' THEN 5.0
        WHEN sde.event_type = 'click' THEN 4.0
        WHEN sde.event_type = 'view' THEN 2.0
        WHEN sde.event_type = 'rating' THEN 3.0
        WHEN sde.event_type = 'search' THEN 1.5
        ELSE 0.0
      END * POWER(2.0, -EXTRACT(EPOCH FROM (now() - sde.created_at)) / (7.0 * 86400))
    ), 0) AS cat_interest,
    MAX(dsc.name) AS cat_name
  FROM public.server_discovery_events sde
  JOIN public.discord_servers ds ON ds.id = sde.server_id
  LEFT JOIN public.discord_server_categories dsc ON dsc.id = ds.category_id
  WHERE sde.user_id = v_user_discord_id
    AND sde.created_at >= now() - interval '30 days'
    AND ds.category_id IS NOT NULL
  GROUP BY ds.category_id;

  SELECT COALESCE(MAX(interest_score), 1.0) INTO v_max_interest 
  FROM temp_user_category_interest;
  IF v_max_interest <= 0 THEN v_max_interest := 1.0; END IF;

  -- 6. Main Recommendation Candidates Query
  RETURN QUERY
  WITH server_penalties AS (
    -- คำนวณ Exposure Penalty พร้อม Time Decay (Half-life 3 วัน)
    SELECT 
      sde.server_id AS p_server_id,
      MAX(
        CASE 
          WHEN sde.event_type = 'save' THEN 0.50
          WHEN sde.event_type = 'click' THEN 0.35
          WHEN sde.event_type = 'view' THEN 0.15
          ELSE 0.0
        END * POWER(2.0, -EXTRACT(EPOCH FROM (now() - sde.created_at)) / (3.0 * 86400))
      ) AS penalty
    FROM public.server_discovery_events sde
    WHERE sde.user_id = v_user_discord_id
      AND sde.created_at >= now() - interval '14 days'
      AND sde.server_id IS NOT NULL
    GROUP BY sde.server_id
  ),
  scored_servers AS (
    SELECT 
      ds.id AS s_id,
      ds.category_id AS s_cat_id,
      COALESCE(uci.category_name, dsc.name) AS s_cat_name,
      -- Normalized Components [0, 1]
      COALESCE(uci.interest_score, 0) / v_max_interest AS raw_match,
      (COALESCE(uci.interest_score, 0) / v_max_interest) * v_confidence AS adjusted_personal_match,
      (1.0 - (1.0 / (1.0 + (COALESCE(ts.discovery_score, 0) / 15.0)))) AS discovery_quality,
      EXP(-EXTRACT(EPOCH FROM (now() - ds.created_at)) / (14.0 * 86400))::numeric AS listing_freshness,
      COALESCE(sp.penalty, 0.0) AS exposure_penalty,
      (uci.interest_score IS NOT NULL AND uci.interest_score > 0) AS has_category_affinity
    FROM public.discord_servers ds
    LEFT JOIN public.discord_server_categories dsc ON dsc.id = ds.category_id
    LEFT JOIN temp_user_category_interest uci ON uci.category_id = ds.category_id
    LEFT JOIN public.get_discovery_trending_scores(7) ts ON ts.server_id = ds.id
    LEFT JOIN server_penalties sp ON sp.p_server_id = ds.id
    WHERE ds.status = 'approved' AND ds.invite_status != 'expired'
  ),
  ranked AS (
    SELECT 
      s_id,
      -- Combined Score [0, 1] clamped at >= 0.0
      GREATEST(
        0.0,
        (adjusted_personal_match * 0.60) +
        (discovery_quality * 0.25) +
        (listing_freshness * 0.15) -
        exposure_penalty
      ) AS final_score,
      CASE 
        WHEN v_confidence >= 0.3 AND has_category_affinity AND s_cat_name IS NOT NULL THEN
          '🎯 เพราะคุณสนใจหมวด' || s_cat_name
        WHEN listing_freshness >= 0.70 THEN
          '🆕 เซิร์ฟเวอร์ใหม่น่าสนใจ'
        WHEN discovery_quality >= 0.50 THEN
          '🔥 กำลังได้รับความนิยม'
        ELSE
          '✨ เซิร์ฟเวอร์แนะนำสำหรับคุณ'
      END AS reason,
      false AS is_explor,
      ROW_NUMBER() OVER (ORDER BY (
        (adjusted_personal_match * 0.60) +
        (discovery_quality * 0.25) +
        (listing_freshness * 0.15) -
        exposure_penalty
      ) DESC, s_id) AS rank_num
    FROM scored_servers
  )
  SELECT 
    s_id AS server_id,
    ROUND(final_score, 4) AS recommendation_score,
    reason AS recommendation_reason,
    is_explor AS is_exploration,
    v_user_state AS user_state
  FROM ranked
  ORDER BY rank_num ASC
  LIMIT v_clamped_limit;
END;
$$;
