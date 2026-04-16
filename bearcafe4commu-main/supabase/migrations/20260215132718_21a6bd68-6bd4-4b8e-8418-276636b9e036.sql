
-- Add foreign keys for tag_warn_cancel_requests to enable joins
ALTER TABLE public.tag_warn_cancel_requests
  ADD CONSTRAINT tag_warn_cancel_requests_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  ADD CONSTRAINT tag_warn_cancel_requests_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id),
  ADD CONSTRAINT tag_warn_cancel_requests_rejected_by_fkey
    FOREIGN KEY (rejected_by) REFERENCES public.profiles(id);
