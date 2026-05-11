-- ═══════════════════════════════════════════════════════════════
-- Campaign Schedule Config
-- Stores the pg_cron schedule for smart announcements
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_schedule_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- cron expression (e.g. '0 3 * * *')
  cron_expression text        NOT NULL DEFAULT '0 3 * * *',
  -- human-readable label stored for display
  label           text        NOT NULL DEFAULT 'ทุกวัน 10:00 น. (ไทย)',
  -- whether the schedule is currently active
  is_enabled      boolean     NOT NULL DEFAULT false,
  -- last time the schedule was updated
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Only one row ever exists (singleton config)
INSERT INTO campaign_schedule_config (id, cron_expression, label, is_enabled)
VALUES ('00000000-0000-0000-0000-000000000001', '0 3 * * *', 'ทุกวัน 10:00 น. (ไทย)', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE campaign_schedule_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_config_read"
  ON campaign_schedule_config FOR SELECT
  USING (true);

CREATE POLICY "schedule_config_admin_write"
  ON campaign_schedule_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );
