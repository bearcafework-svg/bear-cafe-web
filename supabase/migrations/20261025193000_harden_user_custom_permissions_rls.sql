-- Migration: Harden user_custom_permissions RLS and add atomic helper RPC
-- Date: 2026-10-25
-- Purpose: Ensure authenticated users can consistently read their own assigned permissions 
--          even when JWT discord_id claims are being refreshed or mismatched.

ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- 1. Update SELECT policy on user_custom_permissions to be robust against auth.uid() and profiles.id discrepancies
DROP POLICY IF EXISTS "Users can read own custom permissions or page access" ON public.user_custom_permissions;

CREATE POLICY "Users can read own custom permissions or page access" 
ON public.user_custom_permissions 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id IN (
    SELECT id FROM public.profiles 
    WHERE id = auth.uid() 
       OR (discord_id IS NOT NULL AND discord_id = public.get_jwt_discord_id())
  )
  OR public.has_page_access('permissions')
  OR public.is_owner()
);

-- 2. Helper RPC for atomic, single-call retrieval of all allowed pages for the calling user
CREATE OR REPLACE FUNCTION public.get_my_allowed_pages()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT page), '{}')
  FROM (
    SELECT unnest(cp.allowed_pages) AS page
    FROM public.user_custom_permissions ucp
    JOIN public.custom_permissions cp ON cp.id = ucp.permission_id
    WHERE ucp.user_id = auth.uid()
       OR ucp.user_id IN (
         SELECT id FROM public.profiles 
         WHERE id = auth.uid() 
            OR (discord_id IS NOT NULL AND discord_id = public.get_jwt_discord_id())
       )
  ) t;
$$;
