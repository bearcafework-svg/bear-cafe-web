-- Table for per-user server ratings (1-5 stars)
CREATE TABLE IF NOT EXISTS public.server_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   uuid NOT NULL REFERENCES public.discord_servers(id) ON DELETE CASCADE,
  user_id     text NOT NULL,                -- discord_id of the rater
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_ratings_server_id ON public.server_ratings (server_id);

ALTER TABLE public.server_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (for average display)
CREATE POLICY "Anyone can view server ratings"
  ON public.server_ratings FOR SELECT USING (true);

-- Authenticated users can upsert their own rating
CREATE POLICY "Users can upsert own rating"
  ON public.server_ratings FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own rating"
  ON public.server_ratings FOR UPDATE TO authenticated
  USING (true);

-- Trigger: keep updated_at fresh
DROP TRIGGER IF EXISTS set_server_ratings_updated_at ON public.server_ratings;
CREATE TRIGGER set_server_ratings_updated_at
  BEFORE UPDATE ON public.server_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
