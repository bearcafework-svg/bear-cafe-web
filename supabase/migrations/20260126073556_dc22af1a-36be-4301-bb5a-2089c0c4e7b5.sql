-- Create a function to delete sessions older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sessions
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Create a cron job to run cleanup daily at midnight (requires pg_cron extension)
-- Note: pg_cron may not be available, so we use an alternative approach
-- The function can be called manually or via an edge function scheduled job

COMMENT ON FUNCTION public.cleanup_old_sessions() IS 'Deletes session records older than 7 days to maintain database performance';