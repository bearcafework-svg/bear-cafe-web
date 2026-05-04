-- ═══════════════════════════════════════════════════════════════
-- Performance & correctness fixes for the chat matching system
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Indexes on chat_queue ──────────────────────────────────────────────────
-- Without these, every tryMatch() call does a full table scan.
-- With 100 concurrent users polling every 2s = 50 full scans/second.

CREATE INDEX IF NOT EXISTS idx_chat_queue_topic_joined
  ON chat_queue (topic_id, joined_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_queue_joined
  ON chat_queue (joined_at ASC);

-- ── 2. Indexes on chat_sessions ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_b_status
  ON chat_sessions (user_b_id, status);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_a_status
  ON chat_sessions (user_a_id, status);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status
  ON chat_sessions (status);

-- ── 3. Prevent duplicate active sessions for the same user ───────────────────
-- A user should only ever be in one active session at a time.
-- This partial unique index prevents the race condition where two clients
-- simultaneously insert sessions for the same user_b.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_unique_active_user_a
  ON chat_sessions (user_a_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_unique_active_user_b
  ON chat_sessions (user_b_id)
  WHERE status = 'active';

-- ── 4. Atomic match function (eliminates race condition) ─────────────────────
-- This function runs inside a single transaction with advisory locking.
-- Only one caller can match a given partner at a time.
-- Returns the new session row, or NULL if the partner was already taken.
CREATE OR REPLACE FUNCTION try_match_users(
  p_user_a_id       uuid,
  p_user_b_id       uuid,
  p_topic_id        uuid,
  p_user_a_alias    text,
  p_user_b_alias    text,
  p_user_a_avatar   text,
  p_user_b_avatar   text,
  p_user_a_role     text,
  p_user_b_role     text,
  p_duration_secs   integer
)
RETURNS SETOF chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session chat_sessions;
BEGIN
  -- Advisory lock keyed on the smaller UUID to prevent two callers from
  -- racing to match the same pair. pg_try_advisory_xact_lock is released
  -- automatically at transaction end.
  IF NOT pg_try_advisory_xact_lock(
    ('x' || substr(least(p_user_a_id::text, p_user_b_id::text)::text, 1, 16))::bit(64)::bigint
  ) THEN
    -- Another transaction is already matching this pair — bail out
    RETURN;
  END IF;

  -- Verify both users are still in the queue (not already matched)
  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_a_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_b_id) THEN
    RETURN;
  END IF;

  -- Verify neither user is already in an active session
  IF EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE status = 'active'
      AND (user_a_id IN (p_user_a_id, p_user_b_id)
        OR user_b_id IN (p_user_a_id, p_user_b_id))
  ) THEN
    RETURN;
  END IF;

  -- Insert the session
  INSERT INTO chat_sessions (
    topic_id, user_a_id, user_b_id,
    user_a_alias, user_b_alias,
    user_a_avatar, user_b_avatar,
    user_a_role, user_b_role,
    duration_seconds
  ) VALUES (
    p_topic_id, p_user_a_id, p_user_b_id,
    p_user_a_alias, p_user_b_alias,
    p_user_a_avatar, p_user_b_avatar,
    p_user_a_role, p_user_b_role,
    p_duration_secs
  )
  RETURNING * INTO v_session;

  -- Remove both users from the queue atomically
  DELETE FROM chat_queue WHERE user_id IN (p_user_a_id, p_user_b_id);

  RETURN NEXT v_session;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION try_match_users TO authenticated;

-- ── 5. Periodic stale queue cleanup function ──────────────────────────────────
-- Call this from a pg_cron job or scheduled Edge Function.
-- Removes queue entries older than 10 minutes.
CREATE OR REPLACE FUNCTION cleanup_stale_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM chat_queue
  WHERE joined_at < now() - interval '10 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_queue TO authenticated;
