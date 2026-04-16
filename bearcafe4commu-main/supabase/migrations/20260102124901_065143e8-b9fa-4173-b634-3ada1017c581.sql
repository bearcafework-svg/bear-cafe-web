-- 1. Fix banned_words - restrict to admins/moderators only
DROP POLICY IF EXISTS "Anyone can view banned words" ON public.banned_words;

CREATE POLICY "Admins can view banned words"
ON public.banned_words FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'admin'
));

CREATE POLICY "Moderators can view banned words"
ON public.banned_words FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'moderator'
));

-- Revoke anon access
REVOKE ALL ON public.banned_words FROM anon;

-- 2. Fix user_roles - restrict to own roles + admins
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')));

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'admin'
));

-- Revoke anon access
REVOKE ALL ON public.user_roles FROM anon;