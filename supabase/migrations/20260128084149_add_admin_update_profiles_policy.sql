-- Allow admins to update any profile (e.g. bans)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));
