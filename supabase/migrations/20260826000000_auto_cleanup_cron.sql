-- ============================================================================
-- Automated Maintenance Cleanup SQL (pg_cron)
-- Prevents Database Size from exceeding 500 MB & Purges Internal Logs
-- Runs every Sunday at 00:00 UTC
-- ============================================================================

-- Ensure pg_cron extension exists
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unschedule previous cleanup job if it exists
SELECT cron.unschedule('auto-cleanup-system-logs') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-cleanup-system-logs'
);

-- Register weekly cleanup schedule
SELECT cron.schedule(
  'auto-cleanup-system-logs',
  '0 0 * * 0',
  $$
    -- 1. Truncate pg_net response logs (prevents 180MB+ bloat)
    TRUNCATE TABLE net._http_response;

    -- 2. Clean pg_cron execution details older than 7 days
    DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days';

    -- 3. Clean application logs
    SELECT public.clean_old_dm_broadcast_logs(14);
    DELETE FROM public.processed_events WHERE created_at < NOW() - INTERVAL '7 days';
    DELETE FROM public.role_migration_log WHERE created_at < NOW() - INTERVAL '30 days';

    -- 4. Reclaim dead tuples
    VACUUM ANALYZE net._http_response;
    VACUUM ANALYZE cron.job_run_details;
    VACUUM ANALYZE public.role_migration_log;
  $$
);
