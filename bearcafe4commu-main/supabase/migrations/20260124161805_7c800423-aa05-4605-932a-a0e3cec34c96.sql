-- Drop and recreate attempt_match with better safeguards
DROP FUNCTION IF EXISTS public.attempt_match(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.attempt_match(p_user_id uuid, p_category_id uuid, p_role_id uuid)
 RETURNS TABLE(matched_user_id uuid, session_id uuid, success boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate_id uuid;
  v_candidate_user_id uuid;
  v_session_id uuid;
  v_ends_at timestamptz;
  v_my_status text;
  v_my_entry_id uuid;
BEGIN
  -- First verify the caller is still in waiting status
  SELECT mq.id, mq.status INTO v_my_entry_id, v_my_status
  FROM match_queue mq
  WHERE mq.user_id = p_user_id
  FOR UPDATE;

  -- If caller is not waiting, abort
  IF v_my_entry_id IS NULL OR v_my_status != 'waiting' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- Check if user already has an active session created in last 30 seconds (prevent duplicates)
  IF EXISTS (
    SELECT 1 FROM sessions 
    WHERE user_id = p_user_id 
    AND status = 'active'
    AND created_at > NOW() - INTERVAL '30 seconds'
  ) THEN
    -- Mark queue entry as matched to prevent further attempts
    UPDATE match_queue SET status = 'matched' WHERE id = v_my_entry_id;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

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

  -- Double-check candidate hasn't already been matched
  PERFORM 1 FROM match_queue WHERE id = v_candidate_id AND status = 'waiting';
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- Calculate session end time
  v_ends_at := now() + interval '30 minutes';

  -- Create session
  INSERT INTO sessions (user_id, category_id, selected_role_id, duration_minutes, ends_at, status)
  VALUES (p_user_id, p_category_id, p_role_id, 30, v_ends_at, 'active')
  RETURNING id INTO v_session_id;

  -- Update BOTH users' queue entries atomically
  UPDATE match_queue
  SET status = 'matched',
      matched_with = p_user_id,
      matched_session_id = v_session_id,
      updated_at = now()
  WHERE id = v_candidate_id AND status = 'waiting';

  -- Only proceed if candidate was successfully updated (wasn't matched by someone else)
  IF NOT FOUND THEN
    -- Rollback by deleting the session we just created
    DELETE FROM sessions WHERE id = v_session_id;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- Update caller's queue entry
  UPDATE match_queue
  SET status = 'matched',
      matched_with = v_candidate_user_id,
      matched_session_id = v_session_id,
      updated_at = now()
  WHERE id = v_my_entry_id;

  -- Return matched user
  RETURN QUERY SELECT v_candidate_user_id, v_session_id, true;
END;
$function$;