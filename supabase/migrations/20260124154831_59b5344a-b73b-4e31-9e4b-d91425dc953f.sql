-- Create a function for atomic matching to prevent race conditions
CREATE OR REPLACE FUNCTION public.attempt_match(
  p_user_id uuid,
  p_category_id uuid,
  p_role_id uuid
)
RETURNS TABLE(
  matched_user_id uuid,
  session_id uuid,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_id uuid;
  v_candidate_user_id uuid;
  v_session_id uuid;
  v_ends_at timestamptz;
BEGIN
  -- Lock and find a candidate in the same category who is still waiting
  SELECT mq.id, mq.user_id INTO v_candidate_id, v_candidate_user_id
  FROM match_queue mq
  WHERE mq.status = 'waiting'
    AND mq.user_id != p_user_id
    AND (p_category_id IS NULL OR mq.category_id = p_category_id)
    AND (p_role_id IS NULL OR mq.selected_role_id = p_role_id)
  ORDER BY mq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no candidate found
  IF v_candidate_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- Calculate session end time
  v_ends_at := now() + interval '30 minutes';

  -- Create session
  INSERT INTO sessions (user_id, category_id, selected_role_id, duration_minutes, ends_at, status)
  VALUES (p_user_id, p_category_id, p_role_id, 30, v_ends_at, 'active')
  RETURNING id INTO v_session_id;

  -- Update candidate's queue entry
  UPDATE match_queue
  SET status = 'matched',
      matched_with = p_user_id,
      matched_session_id = v_session_id,
      updated_at = now()
  WHERE id = v_candidate_id AND status = 'waiting';

  -- Update requester's queue entry
  UPDATE match_queue
  SET status = 'matched',
      matched_with = v_candidate_user_id,
      matched_session_id = v_session_id,
      updated_at = now()
  WHERE user_id = p_user_id AND status = 'waiting';

  -- Return matched user
  RETURN QUERY SELECT v_candidate_user_id, v_session_id, true;
END;
$$;