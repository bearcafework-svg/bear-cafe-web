-- Create match queue table for real-time matching
CREATE TABLE IF NOT EXISTS public.match_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  selected_role_id UUID REFERENCES public.discord_roles(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
  matched_with UUID,
  matched_session_id UUID REFERENCES public.sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Add columns that may not exist from the earlier migration version
ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'waiting';
ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS matched_with UUID;
ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS matched_session_id UUID REFERENCES public.sessions(id);
ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Enable RLS
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view all waiting queue entries" ON public.match_queue;
CREATE POLICY "Users can view all waiting queue entries"
ON public.match_queue
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own queue entry" ON public.match_queue;
CREATE POLICY "Users can insert own queue entry"
ON public.match_queue
FOR INSERT
WITH CHECK (user_id = get_profile_by_discord_id(get_jwt_discord_id()));

DROP POLICY IF EXISTS "Users can update own queue entry" ON public.match_queue;
CREATE POLICY "Users can update own queue entry"
ON public.match_queue
FOR UPDATE
USING (user_id = get_profile_by_discord_id(get_jwt_discord_id()));

DROP POLICY IF EXISTS "Users can delete own queue entry" ON public.match_queue;
CREATE POLICY "Users can delete own queue entry"
ON public.match_queue
FOR DELETE
USING (user_id = get_profile_by_discord_id(get_jwt_discord_id()));

-- Enable realtime for match_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_queue;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS update_match_queue_updated_at ON public.match_queue;
CREATE TRIGGER update_match_queue_updated_at
BEFORE UPDATE ON public.match_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();