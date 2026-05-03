-- ═══════════════════════════════════════════════════════════════
-- Add is_system flag to chat_messages for Bear Guard alerts
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN chat_messages.is_system IS
  'When true, this is a system-generated alert (e.g. Bear Guard moderation notice) visible to all participants.';
