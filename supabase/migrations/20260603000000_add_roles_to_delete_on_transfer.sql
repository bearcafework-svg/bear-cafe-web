-- Table for roles that must be deleted from source on transfer (but NOT given to target)
CREATE TABLE IF NOT EXISTS public.roles_to_delete_on_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_role_id text NOT NULL UNIQUE,
  role_name text NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles_to_delete_on_transfer ENABLE ROW LEVEL SECURITY;

-- Anyone can view (needed by transfer-roles edge function)
DROP POLICY IF EXISTS "Anyone can view roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
CREATE POLICY "Anyone can view roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR SELECT
  USING (true);

-- Admins can manage
DROP POLICY IF EXISTS "Admins can manage roles_to_delete_on_transfer" ON public.roles_to_delete_on_transfer;
CREATE POLICY "Admins can manage roles_to_delete_on_transfer"
  ON public.roles_to_delete_on_transfer FOR ALL
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));
