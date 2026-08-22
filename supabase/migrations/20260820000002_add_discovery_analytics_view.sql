-- Migration: Add Discovery Analytics & Validation Helper (Plan 2.5)
-- Date: 2026-08-20
-- Plan: Plan 2.5 — Recommendation Validation & Optimization

-- ============================================================================
-- 1. Index ประสิทธิภาพสำหรับ Analytics Aggregation
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_discovery_events_source_type_date 
  ON public.server_discovery_events ((metadata->>'source'), event_type, created_at DESC);

-- ============================================================================
-- 2. RPC Function: คำนวณ Attribution Analytics และ Funnel Metrics ตาม Source
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_discovery_analytics_summary(integer);
DROP FUNCTION IF EXISTS public.get_discovery_analytics_summary();

CREATE OR REPLACE FUNCTION public.get_discovery_analytics_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  source text,
  total_impressions bigint,
  total_views bigint,
  total_clicks bigint,
  total_saves bigint,
  authenticated_clicks bigint,
  guest_clicks bigint,
  ctr numeric,
  view_rate numeric,
  save_rate numeric,
  join_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH filtered_events AS (
    SELECT 
      COALESCE(NULLIF(metadata->>'source', ''), 'unspecified') AS event_source,
      event_type,
      user_id,
      session_id
    FROM public.server_discovery_events
    WHERE created_at >= (now() - (p_days || ' days')::interval)
  ),
  aggregated AS (
    SELECT 
      event_source,
      COUNT(*) FILTER (WHERE event_type = 'impression') AS imps,
      COUNT(*) FILTER (WHERE event_type = 'view') AS views,
      COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
      COUNT(*) FILTER (WHERE event_type = 'save') AS saves,
      COUNT(*) FILTER (WHERE event_type = 'click' AND user_id IS NOT NULL) AS auth_clicks,
      COUNT(*) FILTER (WHERE event_type = 'click' AND user_id IS NULL) AS guest_clicks
    FROM filtered_events
    GROUP BY event_source
  )
  SELECT 
    event_source AS source,
    imps AS total_impressions,
    views AS total_views,
    clicks AS total_clicks,
    saves AS total_saves,
    auth_clicks AS authenticated_clicks,
    guest_clicks AS guest_clicks,
    -- CTR = clicks / impressions (if imps > 0)
    CASE WHEN imps > 0 THEN ROUND((clicks::numeric / imps::numeric), 4) ELSE 0.0 END AS ctr,
    -- View Rate = views / impressions
    CASE WHEN imps > 0 THEN ROUND((views::numeric / imps::numeric), 4) ELSE 0.0 END AS view_rate,
    -- Save Rate = saves / views (or saves / impressions)
    CASE WHEN views > 0 THEN ROUND((saves::numeric / views::numeric), 4) 
         WHEN imps > 0 THEN ROUND((saves::numeric / imps::numeric), 4) 
         ELSE 0.0 END AS save_rate,
    -- Join Rate = clicks / impressions
    CASE WHEN imps > 0 THEN ROUND((clicks::numeric / imps::numeric), 4) ELSE 0.0 END AS join_rate
  FROM aggregated
  ORDER BY clicks DESC, imps DESC;
$$;
