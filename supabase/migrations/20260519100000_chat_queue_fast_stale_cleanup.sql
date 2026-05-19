CREATE OR REPLACE FUNCTION cleanup_stale_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM chat_queue
  WHERE joined_at < now() - interval '45 seconds';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_queue TO authenticated;
