
CREATE TABLE public.server_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

ALTER TABLE public.server_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read server clicks" ON public.server_clicks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can insert own clicks" ON public.server_clicks FOR INSERT TO authenticated WITH CHECK (true);

-- Reset click_count to 0 for all servers (will be recalculated from server_clicks)
UPDATE public.discord_servers SET click_count = 0;
