-- Add description column to discord_roles table
ALTER TABLE public.discord_roles 
ADD COLUMN IF NOT EXISTS description text;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';