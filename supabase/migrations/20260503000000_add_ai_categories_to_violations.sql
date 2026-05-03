-- ═══════════════════════════════════════════════════════════════
-- Add ai_categories column to chat_violations
-- Stores the OpenAI moderation categories that triggered the flag
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE chat_violations
  ADD COLUMN IF NOT EXISTS ai_categories jsonb DEFAULT NULL;

COMMENT ON COLUMN chat_violations.ai_categories IS
  'OpenAI moderation categories that were flagged, e.g. {"harassment": true, "hate": true}. NULL for keyword-based violations.';
