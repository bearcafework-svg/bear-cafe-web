-- 1. Fix profiles RLS - restrict to own profile only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')));

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'admin'
));

CREATE POLICY "Moderators can view profiles"
ON public.profiles FOR SELECT
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'moderator'
));

-- 2. Fix action_logs RLS - remove client INSERT capability
DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.action_logs;

-- 3. Add server-side constraint for session notes
ALTER TABLE public.sessions
ADD CONSTRAINT sessions_note_length_check
CHECK (note IS NULL OR length(note) <= 200);