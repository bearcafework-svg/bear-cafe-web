ALTER TABLE public.discord_roles
ADD COLUMN IF NOT EXISTS description TEXT;
