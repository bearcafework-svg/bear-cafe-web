-- Align rules_presets admin policy with get_jwt_discord_id helper
DROP POLICY IF EXISTS "Admins can manage rules presets" ON public.rules_presets;

CREATE POLICY "Admins can manage rules presets"
ON public.rules_presets
FOR ALL
TO authenticated
USING (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin')
)
WITH CHECK (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin')
);
