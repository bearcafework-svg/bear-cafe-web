-- Migration: 20260804000000_update_campaigns_and_session_ads.sql
-- 1. Remove Ad Placements system tables and triggers
DROP TRIGGER IF EXISTS trg_ad_placements_updated_at ON public.ad_placements;
DROP FUNCTION IF EXISTS public.set_ad_placements_updated_at();
DROP TABLE IF EXISTS public.ad_placement_items CASCADE;
DROP TABLE IF EXISTS public.ad_placements CASCADE;

-- 2. Add Button & Emoji customization fields to session_ads table
ALTER TABLE public.session_ads
  ADD COLUMN IF NOT EXISTS has_button boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS button_label text DEFAULT 'ดูรายละเอียด',
  ADD COLUMN IF NOT EXISTS button_emoji text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS button_emoji_animated boolean DEFAULT false;
