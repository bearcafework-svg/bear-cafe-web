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
  IF NOT pg_try_advisory_xact_lock(('x' || substr(p_user_id::text, 1, 16))::bit(64)::bigint) THEN
    RETURN;
  END IF;

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
    DELETE FROM chat_queue WHERE user_id = p_user_id;
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
    p_user_alias, COALESCE(v_bartender.alias, '☕ Bartender'),
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

GRANT EXECUTE ON FUNCTION try_match_bartender TO authenticated;
