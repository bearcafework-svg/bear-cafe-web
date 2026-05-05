-- ═══════════════════════════════════════════════════════════════
-- Performance & correctness fixes for the chat matching system
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Indexes on chat_queue ──────────────────────────────────────────────────
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_unique_active_user_a
  ON chat_sessions (user_a_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_unique_active_user_b
  ON chat_sessions (user_b_id)
  WHERE status = 'active';

-- ── 4. Atomic match function ──────────────────────────────────────────────────
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
  IF NOT pg_try_advisory_xact_lock(
    ('x' || substr(least(p_user_a_id::text, p_user_b_id::text)::text, 1, 16))::bit(64)::bigint
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_a_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_b_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE status = 'active'
      AND (user_a_id IN (p_user_a_id, p_user_b_id)
        OR user_b_id IN (p_user_a_id, p_user_b_id))
  ) THEN
    RETURN;
  END IF;

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

  DELETE FROM chat_queue WHERE user_id IN (p_user_a_id, p_user_b_id);

  RETURN NEXT v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION try_match_users TO authenticated;

-- ── 5. Stale queue cleanup ────────────────────────────────────────────────────
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
