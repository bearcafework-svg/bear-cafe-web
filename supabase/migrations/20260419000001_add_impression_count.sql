-- Add impression_count column to discord_servers
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS impression_count INTEGER DEFAULT 0;

-- RPC function to safely increment impression count (atomic, no race condition)
CREATE OR REPLACE FUNCTION public.increment_impression(_server_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.discord_servers
  SET impression_count = impression_count + 1
  WHERE id = _server_id;
END;
$$;

-- Allow any authenticated or anonymous user to call this function
GRANT EXECUTE ON FUNCTION public.increment_impression(UUID) TO anon, authenticated;
