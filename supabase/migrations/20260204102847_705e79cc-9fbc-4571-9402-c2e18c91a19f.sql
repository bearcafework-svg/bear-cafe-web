-- Create function to mark expired sessions as completed
CREATE OR REPLACE FUNCTION public.complete_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.sessions
  SET status = 'completed', completed_at = ends_at
  WHERE status = 'active' AND ends_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;