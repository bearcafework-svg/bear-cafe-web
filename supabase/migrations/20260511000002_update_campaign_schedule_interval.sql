-- ═══════════════════════════════════════════════════════════════
-- Update campaign_schedule_config: replace cron_expression with
-- interval_hours (simpler "send every N hours" model)
-- ═══════════════════════════════════════════════════════════════

-- Add interval_hours column (1–168 hours = up to 1 week)
ALTER TABLE campaign_schedule_config
  ADD COLUMN IF NOT EXISTS interval_hours integer NOT NULL DEFAULT 24
    CHECK (interval_hours BETWEEN 1 AND 168);

-- Update the singleton row with a sensible default
UPDATE campaign_schedule_config
SET interval_hours = 24
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Keep cron_expression for pg_cron wiring (always '0 * * * *' = every hour)
-- The actual interval enforcement is done inside the edge function via last_sent_at
UPDATE campaign_schedule_config
SET cron_expression = '0 * * * *',
    label           = 'ส่งทุก 24 ชั่วโมง'
WHERE id = '00000000-0000-0000-0000-000000000001';
