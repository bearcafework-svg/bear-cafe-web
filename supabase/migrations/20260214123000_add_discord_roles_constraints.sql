UPDATE public.discord_roles
SET
  display_name = btrim(display_name),
  discord_role_id = btrim(discord_role_id),
  description = NULLIF(btrim(description), '');

ALTER TABLE public.discord_roles
  ADD CONSTRAINT discord_roles_display_name_not_empty
    CHECK (btrim(display_name) <> ''),
  ADD CONSTRAINT discord_roles_discord_role_id_not_empty
    CHECK (btrim(discord_role_id) <> ''),
  ADD CONSTRAINT discord_roles_description_not_empty
    CHECK (description IS NULL OR btrim(description) <> '');
