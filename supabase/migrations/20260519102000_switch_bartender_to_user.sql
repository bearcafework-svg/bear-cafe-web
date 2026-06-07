CREATE OR REPLACE FUNCTION switch_bartender_to_user(
  p_current_session_id uuid,
  p_user_id uuid,
  p_candidate_id uuid,
  p_topic_id uuid,
  p_user_alias text,
  p_candidate_alias text,
  p_user_avatar text,
  p_candidate_avatar text,
  p_user_role text,
  p_candidate_role text,
  p_duration_secs integer
)
RETURNS SETOF chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_session chat_sessions;
  v_bartender_id uuid;
  v_new_session chat_sessions;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    ('x' || substr(replace(least(p_user_id::text, p_candidate_id::text), '-', ''), 1, 16))::bit(64)::bigint
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_current_session
  FROM chat_sessions
  WHERE id = p_current_session_id
    AND status = 'active'
    AND (user_a_id = p_user_id OR user_b_id = p_user_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT b.user_id INTO v_bartender_id
  FROM chat_bartender_presence b
  WHERE b.is_enabled = true
    AND b.active_session_id = p_current_session_id
    AND (b.user_id = v_current_session.user_a_id OR b.user_id = v_current_session.user_b_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_bartender_presence
    WHERE user_id = p_candidate_id
      AND is_enabled = true
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_queue WHERE user_id = p_candidate_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE status = 'active'
      AND id <> p_current_session_id
      AND (user_a_id IN (p_user_id, p_candidate_id)
        OR user_b_id IN (p_user_id, p_candidate_id))
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
    p_topic_id, p_user_id, p_candidate_id,
    p_user_alias, p_candidate_alias,
    p_user_avatar, p_candidate_avatar,
    COALESCE(p_user_role, 'both'), COALESCE(p_candidate_role, 'both'),
    p_duration_secs
  )
  RETURNING * INTO v_new_session;

  DELETE FROM chat_queue WHERE user_id = p_candidate_id;

  UPDATE chat_sessions
  SET status = 'ended', ended_at = now()
  WHERE id = p_current_session_id
    AND status = 'active';

  UPDATE chat_bartender_presence
  SET is_available = true,
      active_session_id = null,
      updated_at = now()
  WHERE user_id = v_bartender_id
    AND active_session_id = p_current_session_id;

  RETURN NEXT v_new_session;
END;
$$;

GRANT EXECUTE ON FUNCTION switch_bartender_to_user TO authenticated;

