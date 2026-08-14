-- Migration: Fix RLS policies for discord_servers so server owners can update (bump) their servers
-- Date: 2026-08-14

-- Allow both admins and server owners to update server records (bump, refresh info, etc.)
DROP POLICY IF EXISTS "Allow users and admins to update servers" ON public.discord_servers;

CREATE POLICY "Allow users and admins to update servers"
ON public.discord_servers FOR UPDATE
TO authenticated
USING (
  public.is_owner()
  OR public.has_page_access('discord-servers')
  OR (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id))
)
WITH CHECK (
  public.is_owner()
  OR public.has_page_access('discord-servers')
  OR (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id))
);
