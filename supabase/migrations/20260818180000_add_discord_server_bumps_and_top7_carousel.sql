-- Migration: Add bump_count, discord_server_bumps table, and carousel settings for Top 7 active bump Carousel

-- 1. Add bump_count column to discord_servers
ALTER TABLE public.discord_servers 
  ADD COLUMN IF NOT EXISTS bump_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_discord_servers_bump_active 
  ON public.discord_servers(bumped_at DESC, bump_count DESC);

-- 2. Create table for tracking individual server bump history
CREATE TABLE IF NOT EXISTS public.discord_server_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discord_server_bumps_server 
  ON public.discord_server_bumps(server_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discord_server_bumps_created_at 
  ON public.discord_server_bumps(created_at DESC);

-- 3. Enable RLS on discord_server_bumps
ALTER TABLE public.discord_server_bumps ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read bump logs / counts
DROP POLICY IF EXISTS "Anyone can view discord_server_bumps" ON public.discord_server_bumps;
CREATE POLICY "Anyone can view discord_server_bumps"
  ON public.discord_server_bumps
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert bump logs
DROP POLICY IF EXISTS "Authenticated users can insert discord_server_bumps" ON public.discord_server_bumps;
CREATE POLICY "Authenticated users can insert discord_server_bumps"
  ON public.discord_server_bumps
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Seed initial default setting for carousel in site_settings
INSERT INTO public.site_settings (key, value)
VALUES (
  'discord_carousel_settings',
  jsonb_build_object(
    'mode', 'auto_top7',
    'window_days', 7,
    'limit', 7,
    'prioritize_partners', false
  )
)
ON CONFLICT (key) DO NOTHING;
