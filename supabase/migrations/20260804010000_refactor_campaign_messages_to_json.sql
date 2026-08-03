-- Migration: Refactor campaign_messages to store JSONB payload (matching /sticky-messages pattern)
-- Date: 2026-08-04

-- Drop old table and recreate with JSONB payload structure
DROP TABLE IF EXISTS campaign_messages CASCADE;

CREATE TABLE campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_channels TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_messages_updated_at
  BEFORE UPDATE ON campaign_messages
  FOR EACH ROW EXECUTE FUNCTION update_campaign_messages_updated_at();

-- Indexes for performance
CREATE INDEX idx_campaign_messages_is_active ON campaign_messages (is_active, sort_order);
CREATE INDEX idx_campaign_messages_next_send_at ON campaign_messages (next_send_at ASC NULLS FIRST);

-- Row Level Security (RLS)
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_messages_admin_all"
  ON campaign_messages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "campaign_messages_service_read"
  ON campaign_messages FOR SELECT
  TO service_role
  USING (true);
