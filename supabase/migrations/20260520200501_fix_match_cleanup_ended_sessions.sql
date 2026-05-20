-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS cleanup_stale_queue();

-- Fix: match_secret_chat now cleans up queue rows for users who already have
-- an ended session (stale rows left when the other side cancelled first),
-- and also removes the caller's own queue row if they are already in an
-- active session (prevents double-matching after one side cancels).

CREATE OR REPLACE FUNCTION match_secret_chat(
  p_user_id uuid,
  p_topic_id uuid,
  p_user_alias text,
  p_user_avatar text,
  p_user_role text,
  p_duration_secs integer,
  p_allow_cross_topic boolean DEFAULT false,
  p_allow_bartender boolean DEFAULT false
)
RETURNS SETOF chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_self_queue chat_queue%ROWTYPE;
  v_candidate chat_queue%ROWTYPE;
  v_bartender chat_bartender_presence%ROWTYPE;
  v_session chat_sessions;
BEGIN
  -- Advisory lock per user to prevent concurrent calls from the same client
  IF NOT pg_try_advisory_xact_lock(('x' || substr(replace(p_user_id::text, '-', ''), 1, 16))::bit(64)::bigint) THEN
    RETURN;
  END IF;

  -- Purge stale queue rows: users whose most recent session is already ended.
  -- This handles the case where one side cancelled and the other side's queue
  -- row was not cleaned up (e.g. network drop, race condition).
  DELETE FROM chat_queue q
  WHERE q.user_id <> p_user_id
    AND EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.status = 'ended'
        AND (s.user_a_id = q.user_id OR s.user_b_id = q.user_id)
        -- Only purge if there is NO active session for this user
        AND NOT EXISTS (
          SELECT 1 FROM chat_sessions s2
          WHERE s2.status = 'active'
            AND (s2.user_a_id = q.user_id OR s2.user_b_id = q.user_id)
        )
    );

  SELECT * INTO v_self_queue
  FROM chat_queue
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Caller is a bartender — remove from queue and bail
  IF EXISTS (
    SELECT 1 FROM chat_bartender_presence
    WHERE user_id = p_user_id
      AND is_enabled = true
  ) THEN
    DELETE FROM chat_queue WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- Caller already has an active session — clean up their queue row and bail
  IF EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE status = 'active'
      AND (user_a_id = p_user_id OR user_b_id = p_user_id)
  ) THEN
    DELETE FROM chat_queue WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- Find best candidate: same topic (or cross-topic if allowed), not a bartender,
  -- not already in an active session, not already in an ended session with stale queue row.
  SELECT q.* INTO v_candidate
  FROM chat_queue q
  WHERE q.user_id <> p_user_id
    AND q.joined_at >= now() - interval '45 seconds'
    AND (p_allow_cross_topic OR q.topic_id = p_topic_id)
    AND NOT EXISTS (
      SELECT 1 FROM chat_bartender_presence b
      WHERE b.user_id = q.user_id
        AND b.is_enabled = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.status = 'active'
        AND (s.user_a_id = q.user_id OR s.user_b_id = q.user_id)
    )
  ORDER BY q.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO chat_sessions (
      topic_id, user_a_id, user_b_id,
      user_a_alias, user_b_alias,
      user_a_avatar, user_b_avatar,
      user_a_role, user_b_role,
      duration_seconds
    ) VALUES (
      COALESCE(v_candidate.topic_id, p_topic_id), p_user_id, v_candidate.user_id,
      p_user_alias, v_candidate.alias,
      p_user_avatar, v_candidate.avatar,
      COALESCE(p_user_role, 'both'), COALESCE(v_candidate.role, 'both'),
      p_duration_secs
    )
    RETURNING * INTO v_session;

    DELETE FROM chat_queue WHERE user_id IN (p_user_id, v_candidate.user_id);
    RETURN NEXT v_session;
    RETURN;
  END IF;

  -- No regular candidate — try bartender if allowed
  IF NOT p_allow_bartender THEN
    RETURN;
  END IF;

  SELECT * INTO v_bartender
  FROM chat_bartender_presence
  WHERE is_enabled = true
    AND is_online = true
    AND is_available = true
    AND standby_mode = true
    AND user_id <> p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.status = 'active'
        AND (s.user_a_id = chat_bartender_presence.user_id OR s.user_b_id = chat_bartender_presence.user_id)
    )
  ORDER BY updated_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO chat_sessions (
    topic_id, user_a_id, user_b_id,
    user_a_alias, user_b_alias,
    user_a_avatar, user_b_avatar,
    user_a_role, user_b_role,
    duration_seconds
  ) VALUES (
    p_topic_id, p_user_id, v_bartender.user_id,
    p_user_alias, COALESCE(v_bartender.alias, 'เพื่อนในคาเฟ่'),
    p_user_avatar, COALESCE(v_bartender.avatar, 'bear'),
    COALESCE(p_user_role, 'both'), 'both',
    p_duration_secs
  )
  RETURNING * INTO v_session;

  DELETE FROM chat_queue WHERE user_id IN (p_user_id, v_bartender.user_id);

  UPDATE chat_bartender_presence
  SET is_available = false,
      active_session_id = v_session.id,
      updated_at = now()
  WHERE user_id = v_bartender.user_id;

  RETURN NEXT v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION match_secret_chat TO authenticated;

-- Also fix cleanup_stale_queue to also remove queue rows for users
-- whose session has already ended (not just stale by time).
CREATE OR REPLACE FUNCTION cleanup_stale_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove entries older than 45 seconds (original behaviour)
  DELETE FROM chat_queue
  WHERE joined_at < now() - interval '45 seconds';

  -- Remove entries for users who already have an ended session
  -- and no active session (stale rows from cancelled/expired chats)
  DELETE FROM chat_queue q
  WHERE EXISTS (
    SELECT 1 FROM chat_sessions s
    WHERE s.status = 'ended'
      AND (s.user_a_id = q.user_id OR s.user_b_id = q.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM chat_sessions s2
        WHERE s2.status = 'active'
          AND (s2.user_a_id = q.user_id OR s2.user_b_id = q.user_id)
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_queue TO authenticated;
