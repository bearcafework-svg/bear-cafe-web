
-- Table for non-transferable roles (roles that cannot be transferred)
CREATE TABLE IF NOT EXISTS public.non_transferable_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_role_id text NOT NULL UNIQUE,
  role_name text NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.non_transferable_roles ENABLE ROW LEVEL SECURITY;

-- Anyone can view
DROP POLICY IF EXISTS "Anyone can view non-transferable roles" ON public.non_transferable_roles;
CREATE POLICY "Anyone can view non-transferable roles"
  ON public.non_transferable_roles FOR SELECT
  USING (true);

-- Admins can manage
DROP POLICY IF EXISTS "Admins can manage non-transferable roles" ON public.non_transferable_roles;
CREATE POLICY "Admins can manage non-transferable roles"
  ON public.non_transferable_roles FOR ALL
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Table for role transfer logs
CREATE TABLE IF NOT EXISTS public.role_transfer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_discord_id text NOT NULL,
  source_username text,
  target_discord_id text NOT NULL,
  target_username text,
  roles_transferred text[] NOT NULL DEFAULT '{}',
  roles_skipped text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  transferred_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.role_transfer_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins can view transfer logs"
  ON public.role_transfer_logs FOR SELECT
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins can insert transfer logs"
  ON public.role_transfer_logs FOR INSERT
  WITH CHECK (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Admins can update transfer logs"
  ON public.role_transfer_logs FOR UPDATE
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));
