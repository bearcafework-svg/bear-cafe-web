-- Migration: Fix has_any_page_access to grant full access to Owners and Admins
-- Date: 2026-10-25
-- Purpose: Ensures that users with 'owner' or 'admin' role in public.profiles,
--          as well as user_custom_permissions assigned by profile id or auth id,
--          are correctly granted access in Edge Functions (such as discord-roles, search-discord-members).

CREATE OR REPLACE FUNCTION public.has_any_page_access(_user_id uuid, _pages text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Owner or Admin role in profiles (by profile id or matching discord_id)
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE (id = _user_id OR (discord_id IS NOT NULL AND discord_id = (SELECT discord_id FROM public.profiles WHERE id = _user_id)))
        AND role IN ('owner', 'admin')
    )
    -- 2. Moderator or Admin role in user_roles
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role IN ('moderator', 'admin')
    )
    -- 3. Custom permissions check (supports both profile.id and auth.uid mapping)
    OR EXISTS (
      SELECT 1
      FROM public.user_custom_permissions ucp
      JOIN public.custom_permissions cp ON cp.id = ucp.permission_id
      WHERE (
        ucp.user_id = _user_id
        OR ucp.user_id IN (
          SELECT p.id FROM public.profiles p 
          WHERE p.id = _user_id 
             OR (p.discord_id IS NOT NULL AND p.discord_id = (SELECT p2.discord_id FROM public.profiles p2 WHERE p2.id = _user_id))
        )
      )
      AND cp.allowed_pages && _pages
    );
$$;
