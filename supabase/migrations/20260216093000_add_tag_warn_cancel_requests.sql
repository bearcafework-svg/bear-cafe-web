DO $$ BEGIN
  CREATE TYPE public.tag_warn_cancel_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tag_warn_cancel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warn_timestamp TEXT NOT NULL,
  warn_sequence TEXT,
  member_id TEXT,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by_name TEXT,
  request_note TEXT,
  status public.tag_warn_cancel_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns that may not exist from the earlier migration version
ALTER TABLE public.tag_warn_cancel_requests ADD COLUMN IF NOT EXISTS request_note TEXT;
ALTER TABLE public.tag_warn_cancel_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX tag_warn_cancel_requests_pending_unique
  ON public.tag_warn_cancel_requests (warn_timestamp)
  WHERE status = 'pending';

ALTER TABLE public.tag_warn_cancel_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can create cancel requests" ON public.tag_warn_cancel_requests;
CREATE POLICY "Admins can create cancel requests"
  ON public.tag_warn_cancel_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "Admins can read own or owners can read all" ON public.tag_warn_cancel_requests;
CREATE POLICY "Admins can read own or owners can read all"
  ON public.tag_warn_cancel_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "Owners can update cancel requests" ON public.tag_warn_cancel_requests;
CREATE POLICY "Owners can update cancel requests"
  ON public.tag_warn_cancel_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));

CREATE OR REPLACE FUNCTION public.set_tag_warn_cancel_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tag_warn_cancel_requests_updated_at ON public.tag_warn_cancel_requests;
CREATE TRIGGER set_tag_warn_cancel_requests_updated_at
BEFORE UPDATE ON public.tag_warn_cancel_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_tag_warn_cancel_requests_updated_at();
