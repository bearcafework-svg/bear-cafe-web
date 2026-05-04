-- ═══════════════════════════════════════════════════════════════
-- Allow system bot messages by relaxing the sender_id FK constraint.
-- The sentinel UUID 00000000-0000-0000-0000-000000000000 is used as
-- the sender_id for all system/bot messages (น้องฮันนี่).
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop the existing FK constraint on chat_messages.sender_id
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

-- 2. Re-add it as a nullable FK so system messages (sender_id = sentinel)
--    can be inserted without a matching profiles row.
--    We use ON DELETE SET NULL so if a real user is deleted, their messages
--    become anonymous rather than cascade-deleted.
ALTER TABLE chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Update the messages_insert RLS policy to allow NULL sender_id
--    (system messages inserted via service role bypass RLS anyway,
--     but this keeps the policy consistent)
DROP POLICY IF EXISTS "messages_insert" ON chat_messages;

CREATE POLICY "messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    -- Normal user message: must be a participant in an active session
    (auth.uid() = sender_id AND
     EXISTS (
       SELECT 1 FROM chat_sessions s
       WHERE s.id = session_id
         AND s.status = 'active'
         AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
     ))
    OR
    -- System message: sender_id is NULL or sentinel UUID
    sender_id IS NULL
  );
