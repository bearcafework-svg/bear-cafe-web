-- Migration: Drop all DM tables, purge cron references, and remove clean_old_dm_broadcast_logs function
-- Date: 2026-10-30

-- 1. Update pg_cron auto-cleanup job so it does not call clean_old_dm_broadcast_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-cleanup-system-logs') THEN
      PERFORM cron.unschedule('auto-cleanup-system-logs');
      PERFORM cron.schedule(
        'auto-cleanup-system-logs',
        '0 0 * * 0',
        $cron$
          -- 1. Truncate pg_net response logs
          TRUNCATE TABLE net._http_response;

          -- 2. Clean pg_cron execution details older than 7 days
          DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days';

          -- 3. Clean application logs
          DELETE FROM public.processed_events WHERE created_at < NOW() - INTERVAL '7 days';
          DELETE FROM public.role_migration_log WHERE created_at < NOW() - INTERVAL '30 days';

          -- 4. Reclaim dead tuples
          VACUUM ANALYZE net._http_response;
          VACUUM ANALYZE cron.job_run_details;
          VACUUM ANALYZE public.role_migration_log;
        $cron$
      );
    END IF;
  END IF;
END $$;

-- 2. Drop RPC function
DROP FUNCTION IF EXISTS public.clean_old_dm_broadcast_logs(INT);

-- 3. Drop all DM Broadcast and Verification DM tables
DROP TABLE IF EXISTS public.dm_broadcast_logs CASCADE;
DROP TABLE IF EXISTS public.dm_broadcast_system_logs CASCADE;
DROP TABLE IF EXISTS public.dm_broadcast_queues CASCADE;
DROP TABLE IF EXISTS public.dms_options CASCADE;
DROP TABLE IF EXISTS public.member_dm_status CASCADE;

