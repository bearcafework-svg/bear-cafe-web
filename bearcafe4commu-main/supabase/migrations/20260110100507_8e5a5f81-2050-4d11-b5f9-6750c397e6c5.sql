-- Create table for banned Discord roles
CREATE TABLE IF NOT EXISTS public.banned_discord_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_role_id TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.banned_discord_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can view banned roles (needed for edge function)
CREATE POLICY "Anyone can view banned roles"
ON public.banned_discord_roles
FOR SELECT
USING (true);

-- Only admins can manage banned roles
CREATE POLICY "Admins can insert banned roles"
ON public.banned_discord_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banned roles"
ON public.banned_discord_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banned roles"
ON public.banned_discord_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add index for faster lookups
CREATE INDEX idx_banned_discord_roles_role_id ON public.banned_discord_roles(discord_role_id);