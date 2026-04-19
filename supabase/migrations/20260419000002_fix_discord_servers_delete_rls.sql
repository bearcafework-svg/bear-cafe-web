-- Fix RLS: Allow admins with 'discord-servers' page access to DELETE servers
-- The original "Allow owners to manage all servers" FOR ALL only covers is_owner()
-- Admins with custom page access could not delete

-- Add explicit DELETE policy for admins
CREATE POLICY "Allow admins to delete servers"
ON public.discord_servers FOR DELETE
TO authenticated
USING (
  public.is_owner()
  OR public.has_page_access('discord-servers')
);
