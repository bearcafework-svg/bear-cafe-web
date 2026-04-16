-- Daily click stats per server (one row per server per day)
CREATE TABLE IF NOT EXISTS public.server_click_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   uuid NOT NULL REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  stat_date   date NOT NULL DEFAULT CURRENT_DATE,
  click_count integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_server_click_stats_server_date
  ON public.server_click_stats (server_id, stat_date DESC);

ALTER TABLE public.server_click_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read (owners need to see their own stats in dashboard)
CREATE POLICY "Anyone can read click stats"
  ON public.server_click_stats FOR SELECT USING (true);

-- INSERT: authenticated users can only insert stats for servers they own
CREATE POLICY "Authenticated can insert own server click stats"
  ON public.server_click_stats FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discord_servers ds
      JOIN public.profiles p ON p.discord_id = ds.owner_id
      WHERE ds.id = server_id
        AND p.id = auth.uid()
    )
    OR
    -- Also allow any authenticated user to insert (for click tracking from visitors)
    -- The server_id FK ensures the server exists; rate-limiting is handled app-side
    auth.uid() IS NOT NULL
  );

-- UPDATE: same — authenticated users can update stats for any server
-- (click tracking is not sensitive; the count is public anyway)
CREATE POLICY "Authenticated can update click stats"
  ON public.server_click_stats FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS set_server_click_stats_updated_at ON public.server_click_stats;
CREATE TRIGGER set_server_click_stats_updated_at
  BEFORE UPDATE ON public.server_click_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
