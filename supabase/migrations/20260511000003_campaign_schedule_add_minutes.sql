-- ═══════════════════════════════════════════════════════════════
-- Add interval_minutes to campaign_schedule_config
-- Replaces interval_hours as the primary unit (more granular)
-- interval_minutes range: 5 – 10080 (5 min to 1 week)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE campaign_schedule_config
  ADD COLUMN IF NOT EXISTS interval_minutes integer NOT NULL DEFAULT 1440
    CHECK (interval_minutes BETWEEN 5 AND 10080);

-- Migrate existing interval_hours → interval_minutes
UPDATE campaign_schedule_config
SET interval_minutes = interval_hours * 60
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Update label
UPDATE campaign_schedule_config
SET label = 'ส่งทุก 1440 นาที (24 ชั่วโมง)'
WHERE id = '00000000-0000-0000-0000-000000000001';
