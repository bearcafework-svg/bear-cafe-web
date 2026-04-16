-- Create a reusable function to check if a user has access to a specific admin page
-- via Owner role, Admin role, or Custom Permissions
CREATE OR REPLACE FUNCTION public.has_page_access(_user_id uuid, _page text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Owner (moderator) has full access
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'moderator')
    -- Admin has access
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    -- Custom permissions grant page-level access
    OR EXISTS (
      SELECT 1
      FROM public.user_custom_permissions ucp
      JOIN public.custom_permissions cp ON cp.id = ucp.permission_id
      WHERE ucp.user_id = _user_id
        AND _page = ANY(cp.allowed_pages)
    )
$$;

-- Shorthand: check access using JWT discord_id
CREATE OR REPLACE FUNCTION public.jwt_has_page_access(_page text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_page_access(
    public.get_profile_by_discord_id(public.get_jwt_discord_id()),
    _page
  )
$$;