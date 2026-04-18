-- Fix: recreate has_active_session function (missing from schema cache)
-- Fix: add FK user_custom_permissions.permission_id → custom_permissions.id

CREATE OR REPLACE FUNCTION public.has_active_session(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE user_id = _user_id
      AND status = 'active'
      AND ends_at > now()
  );
$$;

ALTER TABLE public.user_custom_permissions
  DROP CONSTRAINT IF EXISTS fk_permission_id;

ALTER TABLE public.user_custom_permissions
  ADD CONSTRAINT fk_permission_id
  FOREIGN KEY (permission_id)
  REFERENCES public.custom_permissions(id)
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
