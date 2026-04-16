-- Healing Messages feature (กระดานให้กำลังใจ)
CREATE TABLE IF NOT EXISTS public.healing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) <= 300),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_healing_messages_status_created_at
  ON public.healing_messages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_healing_messages_author_id_created_at
  ON public.healing_messages (author_id, created_at DESC);

ALTER TABLE public.healing_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own healing messages" ON public.healing_messages;
CREATE POLICY "Users can insert own healing messages"
ON public.healing_messages
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can view approved and own healing messages" ON public.healing_messages;
CREATE POLICY "Users can view approved and own healing messages"
ON public.healing_messages
FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR author_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can manage healing messages" ON public.healing_messages;
CREATE POLICY "Admins can manage healing messages"
ON public.healing_messages
FOR ALL
TO authenticated
USING (
  has_page_access(get_profile_by_discord_id(get_jwt_discord_id()), 'healing-messages')
)
WITH CHECK (
  has_page_access(get_profile_by_discord_id(get_jwt_discord_id()), 'healing-messages')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.healing_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.get_random_healing_message()
RETURNS TABLE (
  message text,
  discord_id text,
  username text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hm.message,
    p.discord_id,
    p.username,
    p.avatar_url
  FROM public.healing_messages hm
  LEFT JOIN public.profiles p ON p.id = hm.author_id
  WHERE hm.status = 'approved'
  ORDER BY random()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_random_healing_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_random_healing_message() TO anon, authenticated, service_role;
