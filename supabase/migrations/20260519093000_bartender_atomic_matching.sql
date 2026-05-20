CREATE OR REPLACE FUNCTION try_match_bartender(
  p_user_id         uuid,
  p_topic_id        uuid,
  p_user_alias      text,
  p_user_avatar     text,
  p_user_role       text,
  p_duration_secs   integer
)
RETURNS SETOF chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bartender chat_bartender_presence%ROWTYPE;
  v_session chat_sessions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_bartender_presence
    WHERE user_id = p_user_id
      AND is_enabled = true
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE status = 'active'
      AND (user_a_id = p_user_id OR user_b_id = p_user_id)
  ) THEN
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

  DELETE FROM chat_queue WHERE user_id = p_user_id;

  UPDATE chat_bartender_presence
  SET is_available = false,
      active_session_id = v_session.id,
      updated_at = now()
  WHERE user_id = v_bartender.user_id;

  RETURN NEXT v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION try_match_bartender TO authenticated;

CREATE OR REPLACE FUNCTION release_bartender_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_bartender_presence
  SET is_available = true,
      active_session_id = null,
      updated_at = now()
  WHERE active_session_id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION release_bartender_session TO authenticated;

CREATE OR REPLACE FUNCTION release_stale_bartenders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE chat_bartender_presence b
  SET is_available = true,
      active_session_id = null,
      updated_at = now()
  WHERE b.active_session_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = b.active_session_id
        AND s.status = 'active'
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION release_stale_bartenders TO authenticated;

CREATE INDEX IF NOT EXISTS idx_chat_bartender_presence_claim
  ON chat_bartender_presence (is_enabled, is_online, is_available, standby_mode, updated_at);

