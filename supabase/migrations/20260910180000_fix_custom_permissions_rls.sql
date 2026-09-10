-- Migration: Fix RLS Policies for custom_permissions and user_custom_permissions
-- Date: 2026-09-10
-- Purpose: Allow owners and admins/staff with 'permissions' access to create, update, and delete custom permissions

-- 1. Ensure custom_permissions has RLS enabled
ALTER TABLE public.custom_permissions ENABLE ROW LEVEL SECURITY;

-- 2. Ensure authenticated users can read custom_permissions
DROP POLICY IF EXISTS "Authenticated can view custom permissions" ON public.custom_permissions;
DROP POLICY IF EXISTS "custom_permissions_read" ON public.custom_permissions;
CREATE POLICY "Authenticated can view custom permissions" ON public.custom_permissions 
FOR SELECT TO authenticated 
USING (true);

-- 3. Allow owners and authorized admins to manage custom_permissions (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Page access: manage custom permissions" ON public.custom_permissions;
DROP POLICY IF EXISTS "Owners can manage custom permissions" ON public.custom_permissions;
DROP POLICY IF EXISTS "custom_permissions_manage" ON public.custom_permissions;

CREATE POLICY "Page access: manage custom permissions" ON public.custom_permissions
FOR ALL TO authenticated
USING (
  public.is_owner() 
  OR public.has_page_access('permissions')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.is_owner() 
  OR public.has_page_access('permissions')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
);

-- 4. Ensure user_custom_permissions has matching manage policy
ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page access: manage custom permissions" ON public.user_custom_permissions;
DROP POLICY IF EXISTS "Owners can manage permission assignments" ON public.user_custom_permissions;
DROP POLICY IF EXISTS "user_custom_permissions_manage" ON public.user_custom_permissions;

CREATE POLICY "Page access: manage custom permissions" ON public.user_custom_permissions
FOR ALL TO authenticated
USING (
  public.is_owner() 
  OR public.has_page_access('permissions')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.is_owner() 
  OR public.has_page_access('permissions')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
);
