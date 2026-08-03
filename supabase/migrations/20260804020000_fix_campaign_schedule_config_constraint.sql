-- Migration: Update check constraint on campaign_schedule_config to allow 1 to 10080 minutes
-- Date: 2026-08-04

ALTER TABLE campaign_schedule_config
  DROP CONSTRAINT IF EXISTS campaign_schedule_config_interval_minutes_check;

ALTER TABLE campaign_schedule_config
  ADD CONSTRAINT campaign_schedule_config_interval_minutes_check
  CHECK (interval_minutes BETWEEN 1 AND 10080);
