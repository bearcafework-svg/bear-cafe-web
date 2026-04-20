-- ============================================================
-- Fix 1: discord-roles function — allow 'contracts' page access
-- ============================================================
-- The discord-roles Edge Function checks has_page_access(_user_id, 'roles')
-- but admins with 'contracts' permission also need to fetch Discord roles
-- (for personal_role contract creation).
-- Solution: update has_page_access to also allow 'contracts' page for discord-roles,
-- OR update the function to accept multiple pages.
-- Simplest fix: add a new DB function that checks any of the given pages.

CREATE OR REPLACE FUNCTION public.has_any_page_access(_user_id uuid, _pages text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'moderator')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_custom_permissions ucp
      JOIN public.custom_permissions cp ON cp.id = ucp.permission_id
      WHERE ucp.user_id = _user_id
        AND cp.allowed_pages && _pages  -- overlap operator: any page in common
    )
$$;

-- ============================================================
-- Fix 2: user_points — allow authenticated users to read own points
-- ============================================================
-- Table schema: user_points(discord_id TEXT PRIMARY KEY, points INTEGER)
-- Must join via profiles to get discord_id from auth.uid()

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own points" ON public.user_points;
DROP POLICY IF EXISTS "Admins can view all points" ON public.user_points;
DROP POLICY IF EXISTS "read_points" ON public.user_points;

CREATE POLICY "read_points"
ON public.user_points
FOR SELECT
TO authenticated
USING (
  discord_id = (
    SELECT discord_id FROM public.profiles WHERE id = auth.uid()
  )
  OR jwt_has_page_access('users')
);
