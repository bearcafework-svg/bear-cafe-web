-- Ensure admins can update all profiles and block banned users from session writes
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role))
WITH CHECK (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;

CREATE POLICY "Users can create own sessions"
ON public.sessions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
      AND is_banned = true
  )
);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;

CREATE POLICY "Users can update own sessions"
ON public.sessions FOR UPDATE
TO authenticated
USING (
  (
    user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
        AND is_banned = true
    )
  )
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
)
WITH CHECK (
  (
    user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
        AND is_banned = true
    )
  )
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
);
