-- Migration: Add Staff Management & Promotion Submissions System
-- Date: 2026-07-16

-- ============================================================
-- 1. Create system_settings Table & Insert Defaults
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.system_settings;
CREATE POLICY "Allow read access for all authenticated users"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow manage settings for Owner only" ON public.system_settings;
CREATE POLICY "Allow manage settings for Owner only"
ON public.system_settings FOR ALL
TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'));

-- Insert default promotion settings
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('promotion_settings', '{
    "post_points": 30,
    "comment_points": 15,
    "max_count": 5,
    "max_images": 5,
    "weeks": [
      {"week": 1, "start": 1, "end": 7},
      {"week": 2, "start": 8, "end": 14},
      {"week": 3, "start": 15, "end": 21},
      {"week": 4, "start": 22, "end": 31}
    ],
    "reminder_rounds": [
      {"id": "3_days", "hours_before": 72, "label": "เหลือ 3 วัน"},
      {"id": "1_day", "hours_before": 24, "label": "เหลือ 1 วัน"},
      {"id": "12_hours", "hours_before": 12, "label": "เหลือ 12 ชั่วโมง"}
    ]
  }'::jsonb, 'Promotion submissions point rewards, limits, weeks, and reminder configurations.')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- ============================================================
-- 2. Create Staff Management Tables
-- ============================================================

-- Table: staff_positions
CREATE TABLE IF NOT EXISTS public.staff_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_role_id text NOT NULL UNIQUE,
  name text NOT NULL,
  display_order integer NOT NULL,
  color text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: staff_levels
CREATE TABLE IF NOT EXISTS public.staff_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL,
  discord_role_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: staff_members
CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id text NOT NULL UNIQUE,
  nickname text,
  position_id uuid REFERENCES public.staff_positions(id) ON DELETE SET NULL,
  level_id uuid REFERENCES public.staff_levels(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  intern_start_at timestamptz,
  intern_end_at timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Vacation', 'Suspended', 'Resigned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: staff_level_history
CREATE TABLE IF NOT EXISTS public.staff_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_level_id uuid REFERENCES public.staff_levels(id) ON DELETE SET NULL,
  to_level_id uuid REFERENCES public.staff_levels(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  reason text NOT NULL
);

-- Table: staff_timeline
CREATE TABLE IF NOT EXISTS public.staff_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'join', 'change_position', 'change_level', 'change_status', etc.
  details text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Table: staff_audit_logs
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'add_staff', 'edit_info', 'change_position', 'change_level', 'change_status', 'delete_staff'
  operator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operator_name text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime for staff tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_members;

-- Seed default Positions
INSERT INTO public.staff_positions (name, discord_role_id, display_order, color, is_active)
VALUES
  ('Owner', '1144253164778946600', 1, '#FF0000', true),
  ('Manager', '1144253164778946601', 2, '#FF7F00', true),
  ('Bartender', '1144253164778946602', 3, '#FFFF00', true),
  ('Barista', '1144253164778946603', 4, '#00FF00', true),
  ('Service', '1144253164778946604', 5, '#0000FF', true),
  ('Designer', '1144253164778946605', 6, '#4B0082', true),
  ('Developer', '1144253164778946606', 7, '#8B00FF', true)
ON CONFLICT (discord_role_id) DO NOTHING;

-- Seed default Levels
INSERT INTO public.staff_levels (name, display_order, discord_role_id, is_active)
VALUES
  ('Trainee', 1, '1144253164778946607', true),
  ('Junior', 2, '1144253164778946608', true),
  ('Staff', 3, '1144253164778946609', true),
  ('Senior', 4, '1144253164778946610', true),
  ('Lead', 5, '1144253164778946611', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Create Promotion Submission Tables
-- ============================================================

-- Table: promotion_submissions
CREATE TABLE IF NOT EXISTS public.promotion_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  week_number integer NOT NULL,
  submission_type text NOT NULL CHECK (submission_type IN ('โพสต์', 'คอมเมนต์', 'none')),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 5),
  images text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'missed')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  points_awarded integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, year, month, week_number)
);

-- Table: promotion_reminder_logs
CREATE TABLE IF NOT EXISTS public.promotion_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  week_number integer NOT NULL,
  reminder_type text NOT NULL, -- '3_days', '1_day', '12_hours'
  sent_at timestamptz DEFAULT now()
);

-- Table: web_notifications
CREATE TABLE IF NOT EXISTS public.web_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create storage bucket: promotion-submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotion-submissions', 'promotion-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for submissions & notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotion_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.web_notifications;

-- ============================================================
-- 4. Enable Row Level Security (RLS) & Policies
-- ============================================================

-- staff_positions & staff_levels
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated" ON public.staff_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage for admin/owner" ON public.staff_positions FOR ALL TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'));

CREATE POLICY "Allow read access for authenticated" ON public.staff_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage for admin/owner" ON public.staff_levels FOR ALL TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'moderator'));

-- staff_members
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own or admin/owner" ON public.staff_members FOR SELECT TO authenticated
USING (
  discord_id = (select discord_id from public.profiles where id = auth.uid())
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);
CREATE POLICY "Allow manage for admin/owner" ON public.staff_members FOR ALL TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')));

-- staff_level_history
ALTER TABLE public.staff_level_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own or admin/owner" ON public.staff_level_history FOR SELECT TO authenticated
USING (
  staff_member_id IN (select id from public.staff_members where discord_id = (select discord_id from public.profiles where id = auth.uid()))
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);
CREATE POLICY "Allow manage for admin/owner" ON public.staff_level_history FOR ALL TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')));

-- staff_timeline
ALTER TABLE public.staff_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own or admin/owner" ON public.staff_timeline FOR SELECT TO authenticated
USING (
  staff_member_id IN (select id from public.staff_members where discord_id = (select discord_id from public.profiles where id = auth.uid()))
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);
CREATE POLICY "Allow manage for admin/owner" ON public.staff_timeline FOR ALL TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')))
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')));

-- staff_audit_logs
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for admin/owner only" ON public.staff_audit_logs FOR SELECT TO authenticated
USING (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')));
CREATE POLICY "Allow insert for admin/owner only" ON public.staff_audit_logs FOR INSERT TO authenticated
WITH CHECK (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator')));

-- promotion_submissions
ALTER TABLE public.promotion_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own or admin/owner" ON public.promotion_submissions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);
CREATE POLICY "Allow insert own" ON public.promotion_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow update own pending or admin/owner" ON public.promotion_submissions FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
)
WITH CHECK (
  (user_id = auth.uid() AND status = 'pending')
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);
CREATE POLICY "Allow delete own pending or admin/owner" ON public.promotion_submissions FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);

-- promotion_reminder_logs
ALTER TABLE public.promotion_reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own or admin/owner" ON public.promotion_reminder_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'moderator'))
);

-- web_notifications
ALTER TABLE public.web_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own" ON public.web_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Allow update own" ON public.web_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Storage Bucket Policies
DROP POLICY IF EXISTS "storage_promotion_submissions_public_read" ON storage.objects;
CREATE POLICY "storage_promotion_submissions_public_read" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'promotion-submissions');

DROP POLICY IF EXISTS "storage_promotion_submissions_insert" ON storage.objects;
CREATE POLICY "storage_promotion_submissions_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'promotion-submissions');

DROP POLICY IF EXISTS "storage_promotion_submissions_delete" ON storage.objects;
CREATE POLICY "storage_promotion_submissions_delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'promotion-submissions');

-- ============================================================
-- 5. PG RPC Functions (Transactions)
-- ============================================================

-- Function: approve_promotion_submission
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

  -- Get points settings
  SELECT COALESCE(
    CASE 
      WHEN v_submission.submission_type = 'โพสต์' THEN (value->>'post_points')::integer
      WHEN v_submission.submission_type = 'คอมเมนต์' THEN (value->>'comment_points')::integer
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

-- Function: rollback_promotion_approval
CREATE OR REPLACE FUNCTION public.rollback_promotion_approval(
  p_operator_id uuid,
  p_submission_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission record;
  v_audit_log  record;
BEGIN
  -- Fetch approved submission
  SELECT * INTO v_submission
  FROM public.promotion_submissions
  WHERE id = p_submission_id FOR UPDATE;

  IF v_submission IS NULL OR v_submission.status <> 'approved' THEN
    RETURN false;
  END IF;

  -- Subtract points from user_points
  UPDATE public.user_points
  SET points = GREATEST(0, points - v_submission.points_awarded),
      updated_at = now()
  WHERE discord_id = v_submission.discord_id;

  -- Revert submission to pending
  UPDATE public.promotion_submissions
  SET status = 'pending',
      approved_by = NULL,
      approved_at = NULL,
      points_awarded = 0,
      updated_at = now()
  WHERE id = p_submission_id;

  -- Create negative notification
  INSERT INTO public.web_notifications (user_id, title, message, type)
  VALUES (
    v_submission.user_id,
    'ระบบขัดข้อง: ยกเลิกการอนุมัติงานโปรโมท ⚠️',
    'เกิดความผิดพลาดในการส่งข้อความ Discord DM จึงยกเลิกแต้มและการอนุมัติ กรุณาติดต่อทีมงาน',
    'error'
  );

  -- Log rollback audit
  INSERT INTO public.staff_audit_logs (staff_member_id, action, operator_id, operator_name, before_data, after_data)
  VALUES (
    (select id from public.staff_members where discord_id = v_submission.discord_id limit 1),
    'rollback_approve_submission',
    p_operator_id,
    (select username from public.profiles where id = p_operator_id limit 1),
    row_to_json(v_submission)::jsonb,
    row_to_json((select r from public.promotion_submissions r where r.id = p_submission_id))::jsonb
  );

  RETURN true;
END;
$$;
