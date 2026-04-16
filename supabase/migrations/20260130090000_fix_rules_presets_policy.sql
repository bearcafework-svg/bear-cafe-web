-- Align rules_presets admin policy with auth.uid fallback
DROP POLICY IF EXISTS "Admins can manage rules presets" ON public.rules_presets;

CREATE POLICY "Admins can manage rules presets"
ON public.rules_presets
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
);
