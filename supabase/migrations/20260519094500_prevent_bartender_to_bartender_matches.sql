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
  v_user_a_is_bartender boolean;
  v_user_b_is_bartender boolean;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    ('x' || substr(replace(least(p_user_a_id::text, p_user_b_id::text), '-', ''), 1, 16))::bit(64)::bigint
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_a_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_user_b_id) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM chat_bartender_presence
    WHERE user_id = p_user_a_id
      AND is_enabled = true
  ) INTO v_user_a_is_bartender;

  SELECT EXISTS (
    SELECT 1 FROM chat_bartender_presence
    WHERE user_id = p_user_b_id
      AND is_enabled = true
  ) INTO v_user_b_is_bartender;

  IF v_user_b_is_bartender THEN
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

