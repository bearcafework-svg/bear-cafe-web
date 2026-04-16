-- Update role_transfer_logs RLS to allow moderator (Owner) access too

DROP POLICY IF EXISTS "Admins can view transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins and owners can view transfer logs"
  ON public.role_transfer_logs FOR SELECT
  USING (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Admins can insert transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins and owners can insert transfer logs"
  ON public.role_transfer_logs FOR INSERT
  WITH CHECK (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Admins can update transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins and owners can update transfer logs"
  ON public.role_transfer_logs FOR UPDATE
  USING (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );