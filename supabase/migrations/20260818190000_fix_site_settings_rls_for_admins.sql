-- Fix RLS policy on site_settings so owners and admins can insert/update settings (including carousel settings)

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow manage settings for Owner only" ON public.site_settings;
DROP POLICY IF EXISTS "Owners can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Owners can insert site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow manage settings for owners and admins" ON public.site_settings;

-- 2. Anyone (anon + authenticated) can view site settings
CREATE POLICY "Anyone can view site settings"
ON public.site_settings FOR SELECT
USING (true);

-- 3. Allow Owners, Admins, and users with relevant page access to insert/update/delete site settings
CREATE POLICY "Allow manage settings for owners and admins"
ON public.site_settings FOR ALL
TO authenticated
USING (
  public.is_owner()
  OR public.has_page_access('discord-servers')
  OR public.has_page_access('settings')
  OR public.has_page_access('server-listing')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.is_owner()
  OR public.has_page_access('discord-servers')
  OR public.has_page_access('settings')
  OR public.has_page_access('server-listing')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (id = auth.uid() OR discord_id = public.get_jwt_discord_id()) 
    AND role IN ('owner', 'admin')
  )
);
