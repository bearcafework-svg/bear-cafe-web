-- Fix Point Calculation to multiply by count, update RLS policies and add points rollback trigger

-- 1. Update approve_promotion_submission function to multiply points by count
CREATE OR REPLACE FUNCTION public.approve_promotion_submission(
  p_operator_id uuid,
  p_submission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission      record;
  v_points          integer;
  v_discord_id      text;
  v_user_points_exist boolean;
  v_result          jsonb;
BEGIN
  -- 1. ตรวจสอบว่ายังไม่เคยอนุมัติ
  SELECT * INTO v_submission
  FROM public.promotion_submissions
  WHERE id = p_submission_id FOR UPDATE;

  IF v_submission IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_submission.status <> 'pending' THEN
    RAISE EXCEPTION 'Submission is already processed';
  END IF;

  v_discord_id := v_submission.discord_id;

  -- Get points settings and multiply by submission count
  SELECT COALESCE(
    CASE 
      WHEN v_submission.submission_type = 'โพสต์' THEN (value->>'post_points')::integer * v_submission.count
      WHEN v_submission.submission_type = 'คอมเมนต์' THEN (value->>'comment_points')::integer * v_submission.count
      ELSE 0
    END, 0
  ) INTO v_points
  FROM public.system_settings
  WHERE key = 'promotion_settings';

  -- 2. เพิ่มแต้ม user_points
  SELECT EXISTS(SELECT 1 FROM public.user_points WHERE discord_id = v_discord_id) INTO v_user_points_exist;
  
  IF v_user_points_exist THEN
    UPDATE public.user_points
    SET points = points + v_points,
        updated_at = now()
    WHERE discord_id = v_discord_id;
  ELSE
    INSERT INTO public.user_points (discord_id, points, max_cap)
    VALUES (v_discord_id, v_points, 0);
  END IF;

  -- 3. บันทึก Approval ใน Submission
  UPDATE public.promotion_submissions
  SET status = 'approved',
      approved_by = p_operator_id,
      approved_at = now(),
      points_awarded = v_points,
      updated_at = now()
  WHERE id = p_submission_id;

  -- 4. บันทึก Notification ภายในเว็บไซต์
  INSERT INTO public.web_notifications (user_id, title, message, type)
  VALUES (
    v_submission.user_id,
    'อนุมัติงานโปรโมทแล้ว 🎉',
    'งานโปรโมทประเภท ' || v_submission.submission_type || ' สัปดาห์ที่ ' || v_submission.week_number || ' ได้รับการอนุมัติแล้ว คุณได้รับแต้มสะสม +' || v_points || ' แต้ม',
    'success'
  );

  -- 5. บันทึก Audit Log
  INSERT INTO public.staff_audit_logs (staff_member_id, action, operator_id, operator_name, before_data, after_data)
  VALUES (
    (select id from public.staff_members where discord_id = v_discord_id limit 1),
    'approve_submission',
    p_operator_id,
    (select username from public.profiles where id = p_operator_id limit 1),
    row_to_json(v_submission)::jsonb,
    row_to_json((select r from public.promotion_submissions r where r.id = p_submission_id))::jsonb
  );

  v_result := jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'discord_id', v_discord_id,
    'user_id', v_submission.user_id
  );

  RETURN v_result;
END;
$$;

-- 2. Drop old policy and create new one allowing users to edit approved submissions
DROP POLICY IF EXISTS "Allow update own pending or admin/owner" ON public.promotion_submissions;

CREATE POLICY "Allow update own pending/approved or admin/owner" ON public.promotion_submissions FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND status IN ('pending', 'approved'))
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
)
WITH CHECK (
  (user_id = auth.uid() AND status = 'pending')
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);

-- 3. Create Points Rollback trigger to rollback points when user edits approved submission
CREATE OR REPLACE FUNCTION public.tr_before_promotion_submission_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changes from approved to pending, rollback points
  IF OLD.status = 'approved' AND NEW.status = 'pending' THEN
    UPDATE public.user_points
    SET points = GREATEST(0, points - OLD.points_awarded),
        updated_at = now()
    WHERE discord_id = OLD.discord_id;
    
    NEW.points_awarded := 0;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_promotion_submission_update ON public.promotion_submissions;

CREATE TRIGGER before_promotion_submission_update
  BEFORE UPDATE ON public.promotion_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_before_promotion_submission_update();
