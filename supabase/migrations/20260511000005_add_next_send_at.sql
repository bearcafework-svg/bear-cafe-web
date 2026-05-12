-- ═══════════════════════════════════════════════════════════════
-- Add next_send_at to campaign_messages
-- Replaces the per-campaign cooldown check with a global queue:
-- each campaign has an explicit "send me at this time" timestamp.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE campaign_messages
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz;

-- Campaigns with no next_send_at are treated as "send immediately"
-- (NULL = ready to send, same as before)

CREATE INDEX IF NOT EXISTS idx_campaign_messages_next_send_at
  ON campaign_messages (next_send_at ASC NULLS FIRST)
  WHERE is_active = true;
