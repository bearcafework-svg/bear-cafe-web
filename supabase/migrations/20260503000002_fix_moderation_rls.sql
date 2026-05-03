-- ═══════════════════════════════════════════════════════════════
-- Fix RLS policies so the moderate-chat Edge Function (service role)
-- can insert violations and system messages without being blocked.
--
-- Root cause: service role key bypasses RLS entirely when using
-- the Supabase client library, but raw REST calls with service role
-- still evaluate RLS unless the policy explicitly allows it.
-- The safest fix is to add a service-role bypass policy.
-- ═══════════════════════════════════════════════════════════════

-- ── chat_violations: allow service-role inserts ───────────────────────────────
DROP POLICY IF EXISTS "violations_insert"            ON chat_violations;
DROP POLICY IF EXISTS "violations_insert_service"    ON chat_violations;

-- Authenticated users can log their own violations
CREATE POLICY "violations_insert" ON chat_violations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (Edge Function) can insert any violation (bypasses auth.uid check)
-- auth.role() = 'service_role' is true when using the service role key
CREATE POLICY "violations_insert_service" ON chat_violations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── chat_messages: allow service-role system message inserts ─────────────────
DROP POLICY IF EXISTS "messages_insert"              ON chat_messages;
DROP POLICY IF EXISTS "messages_insert_system"       ON chat_messages;

-- Normal users: must be a participant in an active session
CREATE POLICY "messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.status = 'active'
        AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
    )
  );

-- Service role (Edge Function): can insert system messages for any session
CREATE POLICY "messages_insert_system" ON chat_messages FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
