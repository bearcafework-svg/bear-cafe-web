-- Drop obsolete banned_discord_roles table and associated policies
DROP TABLE IF EXISTS public.banned_discord_roles CASCADE;

-- Remove 'banned-roles' from existing custom_permissions allowed_pages
UPDATE public.custom_permissions
SET allowed_pages = array_remove(allowed_pages, 'banned-roles')
WHERE 'banned-roles' = ANY(allowed_pages);
