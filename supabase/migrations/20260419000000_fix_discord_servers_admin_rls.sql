-- Fix RLS: Allow admins with 'discord-servers' page access to see ALL servers
-- Previously only is_owner() could see all servers; admins with custom permissions were blocked

-- Drop the old restrictive SELECT policy for authenticated users
DROP POLICY IF EXISTS "Allow owners to see all servers for QC" ON public.discord_servers;

-- New policy: Owner OR admin with page access can see ALL servers (any status)
CREATE POLICY "Allow admin to see all servers for QC"
ON public.discord_servers FOR SELECT
TO authenticated
USING (
  public.is_owner()
  OR public.has_page_access('discord-servers')
  OR (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id))
);

-- Also fix UPDATE policy so admins can approve/reject
DROP POLICY IF EXISTS "Allow users to update their own servers" ON public.discord_servers;

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
