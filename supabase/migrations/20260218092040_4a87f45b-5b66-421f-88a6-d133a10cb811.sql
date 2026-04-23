
-- Custom permissions table
CREATE TABLE IF NOT EXISTS public.custom_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  allowed_pages text[] NOT NULL DEFAULT '{}',
  color text DEFAULT '#6366f1',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_permissions ENABLE ROW LEVEL SECURITY;

-- Only Owner (moderator role) can manage
DROP POLICY IF EXISTS "Owners can manage custom permissions" ON public.custom_permissions;
CREATE POLICY "Owners can manage custom permissions"
ON public.custom_permissions FOR ALL
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Authenticated users can view permissions (needed for access checks)
DROP POLICY IF EXISTS "Authenticated can view custom permissions" ON public.custom_permissions;
CREATE POLICY "Authenticated can view custom permissions"
ON public.custom_permissions FOR SELECT
USING (true);

-- User-permission assignments table
CREATE TABLE IF NOT EXISTS public.user_custom_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.custom_permissions(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can manage assignments
DROP POLICY IF EXISTS "Owners can manage permission assignments" ON public.user_custom_permissions;
CREATE POLICY "Owners can manage permission assignments"
ON public.user_custom_permissions FOR ALL
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Users can view their own assignments
DROP POLICY IF EXISTS "Users can view own permission assignments" ON public.user_custom_permissions;
CREATE POLICY "Users can view own permission assignments"
ON public.user_custom_permissions FOR SELECT
USING (user_id = get_profile_by_discord_id(get_jwt_discord_id()));

-- Admins can view all assignments (for admin page access check)
DROP POLICY IF EXISTS "Admins can view all permission assignments" ON public.user_custom_permissions;
CREATE POLICY "Admins can view all permission assignments"
ON public.user_custom_permissions FOR SELECT
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_custom_permissions_updated_at ON public.custom_permissions;
CREATE TRIGGER update_custom_permissions_updated_at
BEFORE UPDATE ON public.custom_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
