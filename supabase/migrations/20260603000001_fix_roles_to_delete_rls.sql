-- Fix RLS policies for roles_to_delete_on_transfer
-- FOR ALL with only USING doesn't cover INSERT (needs WITH CHECK)
-- Also include moderator role (Owner uses moderator, not admin)

DROP POLICY IF EXISTS "Anyone can view roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
DROP POLICY IF EXISTS "Admins can manage roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
DROP POLICY IF EXISTS "Admins can insert roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
DROP POLICY IF EXISTS "Admins can update roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
DROP POLICY IF EXISTS "Admins can delete roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;

-- Anyone can view
CREATE POLICY "Anyone can view roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR SELECT
  USING (true);

-- Admins/owners can insert
CREATE POLICY "Admins can insert roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR INSERT
  WITH CHECK (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

-- Admins/owners can update
CREATE POLICY "Admins can update roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR UPDATE
  USING (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  )
  WITH CHECK (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

-- Admins/owners can delete
CREATE POLICY "Admins can delete roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR DELETE
  USING (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );
