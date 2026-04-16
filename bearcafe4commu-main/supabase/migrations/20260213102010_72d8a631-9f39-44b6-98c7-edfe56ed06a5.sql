
-- Create tag_warn_cancel_requests table for the approval workflow
CREATE TABLE public.tag_warn_cancel_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warn_timestamp TEXT NOT NULL,
  warn_sequence TEXT,
  member_id TEXT,
  requested_by UUID NOT NULL,
  requested_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tag_warn_cancel_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view all cancel requests
CREATE POLICY "Admins can view cancel requests"
  ON public.tag_warn_cancel_requests
  FOR SELECT
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Admins can create cancel requests
CREATE POLICY "Admins can create cancel requests"
  ON public.tag_warn_cancel_requests
  FOR INSERT
  WITH CHECK (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Owners (moderator role) can update cancel requests (approve/reject)
CREATE POLICY "Owners can update cancel requests"
  ON public.tag_warn_cancel_requests
  FOR UPDATE
  USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Unique constraint: only one pending request per warn_timestamp
CREATE UNIQUE INDEX tag_warn_cancel_requests_pending_unique
  ON public.tag_warn_cancel_requests (warn_timestamp)
  WHERE status = 'pending';
