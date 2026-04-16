-- Create helper for discord_id from JWT metadata (fallback to top-level claim)
CREATE OR REPLACE FUNCTION public.get_jwt_discord_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt()->'user_metadata'->>'discord_id',
    auth.jwt()->'user_metadata'->>'provider_id',
    auth.jwt()->>'discord_id'
  )
$$;

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
