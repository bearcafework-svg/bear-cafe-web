-- 1. Drop all existing profiles SELECT policies and recreate with explicit auth requirement
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view profiles" ON public.profiles;

-- Recreate with TO authenticated to explicitly require authentication
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')));

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'admin'
));

CREATE POLICY "Moderators can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'moderator'
));

-- 2. Ensure action_logs has no INSERT policy (already dropped, but be explicit)
DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.action_logs;

-- Also update the admin view policy to require authentication
DROP POLICY IF EXISTS "Admins can view action logs" ON public.action_logs;

CREATE POLICY "Admins can view action logs"
ON public.action_logs FOR SELECT
TO authenticated
USING (public.has_role(
  (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
  'admin'
));

-- 3. Revoke any direct anon access to these tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.action_logs FROM anon;

-- Grant only to authenticated role (RLS will still apply)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.action_logs TO authenticated;