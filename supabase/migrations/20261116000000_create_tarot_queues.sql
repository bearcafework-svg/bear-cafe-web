-- Create table for Tarot Queues
CREATE TABLE IF NOT EXISTS public.tarot_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type TEXT NOT NULL,
    queue_number TEXT NOT NULL,
    customer_name TEXT DEFAULT '',
    prediction TEXT DEFAULT '',
    queue_group TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ
);

-- Ensure prediction column exists if table was already created
ALTER TABLE public.tarot_queues ADD COLUMN IF NOT EXISTS prediction TEXT DEFAULT '';

-- Swap legacy group 1 -> 2 and group 2 -> 1
UPDATE public.tarot_queues
SET queue_group = CASE
    WHEN queue_group LIKE '%กลุ่ม 1%' OR queue_group LIKE '%กลุ่ม1%' THEN 'กลุ่ม2💫'
    WHEN queue_group LIKE '%กลุ่ม 2%' OR queue_group LIKE '%กลุ่ม2%' THEN '❤️กลุ่ม1'
    ELSE queue_group
END
WHERE queue_group LIKE '%กลุ่ม 1%' OR queue_group LIKE '%กลุ่ม1%' OR queue_group LIKE '%กลุ่ม 2%' OR queue_group LIKE '%กลุ่ม2%';

-- Index for instant sorting and queries (speed optimization)
CREATE INDEX IF NOT EXISTS idx_tarot_queues_created_at ON public.tarot_queues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarot_queues_status ON public.tarot_queues(status);

-- Enable Row Level Security (RLS) for safety
ALTER TABLE public.tarot_queues ENABLE ROW LEVEL SECURITY;

-- Owner & Admin full access policy
CREATE POLICY "Allow owners and admins to manage tarot_queues"
ON public.tarot_queues
FOR ALL
TO authenticated
USING (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'moderator'::public.app_role)
  OR public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'moderator'::public.app_role)
  OR public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin'::public.app_role)
);

-- Enable Supabase Realtime broadcast for instant cross-device syncing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tarot_queues'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tarot_queues;
  END IF;
END $$;
