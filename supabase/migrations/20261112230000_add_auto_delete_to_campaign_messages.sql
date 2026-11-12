-- Add auto_delete_seconds to campaign_messages
-- Date: 2026-11-12
-- Allows specifying how many seconds after sending before a campaign message is automatically deleted.
-- 0 or NULL means no automatic deletion (remains until replaced by the next cycle).

ALTER TABLE campaign_messages
ADD COLUMN IF NOT EXISTS auto_delete_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN campaign_messages.auto_delete_seconds IS 'Seconds after broadcast to auto-delete the message. 0 or NULL disables auto-deletion.';

