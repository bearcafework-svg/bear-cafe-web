-- Allow moderators (Owner) to view all user roles
DROP POLICY IF EXISTS "Moderators can view all roles" ON public.user_roles;
CREATE POLICY "Moderators can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Allow moderators (Owner) to manage user roles (insert/delete)
DROP POLICY IF EXISTS "Moderators can manage roles" ON public.user_roles;
CREATE POLICY "Moderators can manage roles"
ON public.user_roles
FOR ALL
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role))
WITH CHECK (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));