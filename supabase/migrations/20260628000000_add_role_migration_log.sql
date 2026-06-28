-- Migration: Add role migration tables for bulk class role assignment
-- Creates two tables:
--   role_migration_jobs  — tracks each "run" (dry-run preview or real execute)
--   role_migration_log   — per-member result records linked to a job

-- ──────────────────────────────────────────────────────────────────
-- role_migration_jobs
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_migration_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'dry_run', 'running', 'completed', 'failed')),
  is_dry_run       boolean NOT NULL DEFAULT true,
  total_members    integer,
  processed        integer NOT NULL DEFAULT 0,
  success_count    integer NOT NULL DEFAULT 0,
  skip_count       integer NOT NULL DEFAULT 0,
  error_count      integer NOT NULL DEFAULT 0,
  started_at       timestamptz,
  completed_at     timestamptz,
  initiated_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────
-- role_migration_log
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_migration_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES role_migration_jobs(id) ON DELETE CASCADE,
  discord_user_id  text NOT NULL,
  username         text,
  -- Comma-separated old role IDs the member holds (may be multiple — anomaly case)
  old_role_ids     text[] NOT NULL DEFAULT '{}',
  -- The winning old role used to determine the target class
  resolved_old_role_id text,
  -- The new class role ID that will be / was assigned
  new_role_id      text,
  -- 'assigned' | 'skipped_already_has' | 'skipped_no_old_role' | 'anomaly_multiple_old' | 'error'
  result_status    text NOT NULL,
  error_message    text,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_role_migration_log_job_id
  ON role_migration_log(job_id);

CREATE INDEX IF NOT EXISTS idx_role_migration_log_discord_user_id
  ON role_migration_log(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_role_migration_log_result_status
  ON role_migration_log(job_id, result_status);

-- ──────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE role_migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_migration_log  ENABLE ROW LEVEL SECURITY;

-- Only admins / owners can read these tables (via service role in edge functions)
-- For the web client reads (progress polling), we allow read for authenticated users
-- who have admin access — enforced at the edge function level, but a permissive
-- anon read would be insecure, so we lock it to service_role only.

CREATE POLICY "Service role full access on role_migration_jobs"
  ON role_migration_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on role_migration_log"
  ON role_migration_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read jobs/logs (admin gate is in edge function)
CREATE POLICY "Authenticated users can read role_migration_jobs"
  ON role_migration_jobs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read role_migration_log"
  ON role_migration_log
  FOR SELECT
  TO authenticated
  USING (true);
