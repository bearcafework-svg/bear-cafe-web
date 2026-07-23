-- Function to clean old completed broadcast logs
CREATE OR REPLACE FUNCTION public.clean_old_dm_broadcast_logs(days_older INT DEFAULT 14)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.dm_broadcast_logs
    WHERE queue_id IN (
        SELECT id FROM public.dm_broadcast_queues
        WHERE status IN ('completed', 'cancelled')
          AND updated_at < (NOW() - (days_older || ' days')::INTERVAL)
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Grant execution to authenticated, anon, and service_role
GRANT EXECUTE ON FUNCTION public.clean_old_dm_broadcast_logs(INT) TO authenticated, anon, service_role;
